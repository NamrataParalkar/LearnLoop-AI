import os
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
import models
from database import SessionLocal
from ingestion.parser_pdf import parse_pdf
from ingestion.parser_pptx import parse_pptx
from ingestion.parser_video import parse_video
from ingestion.chunker import chunk_units
from ingestion.figures import process_figures
from ingestion.structurer import build_hierarchy, tag_chunks
from sentence_transformers import SentenceTransformer
from app.config import settings

logger = logging.getLogger(__name__)
executor = ThreadPoolExecutor(max_workers=4)
# Lazy load model
def get_embed_model():
    global embed_model
    if embed_model is None:
        try:
            # Prefer fast, lightweight 384/768-dim model or existing local cache
            embed_model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception:
            try:
                embed_model = SentenceTransformer('BAAI/bge-m3')
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer: {e}")
                embed_model = None
    return embed_model

def get_embeddings(texts: list[str]) -> list[list[float]]:
    try:
        model = get_embed_model()
        if model:
            embeddings = model.encode(texts, normalize_embeddings=True)
            return embeddings.tolist()
    except Exception as e:
        logger.warning(f"Embedding generation error: {e}")
    # Deterministic fallback embedding representation
    return [[0.0] * settings.embed_dim for _ in texts]

async def run_ingestion_async(source_id: int):
    db = SessionLocal()
    source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if not source:
        db.close()
        return

    try:
        source.status = "processing"
        source.progress = 10
        db.commit()
        
        # 1. Parse
        loop = asyncio.get_running_loop()
        if source.source_type == "pdf":
            units = await loop.run_in_executor(executor, parse_pdf, source_id, source.file_path)
        elif source.source_type == "pptx":
            units = await loop.run_in_executor(executor, parse_pptx, source_id, source.file_path)
        elif source.source_type == "video":
            units = await loop.run_in_executor(executor, parse_video, source_id, source.file_path)
        else:
            raise ValueError(f"Unknown source type {source.source_type}")
            
        source.progress = 30
        db.commit()
        
        # 2. Figures (Vision LLM)
        units = await process_figures(units)
        source.progress = 50
        db.commit()
        
        # 3. Chunk
        chunks_data = chunk_units(units)
        
        # Delete old chunks if idempotent re-run
        db.query(models.Chunk).filter(models.Chunk.source_id == source.id).delete()
        
        # Insert Chunks (without embeddings first to get IDs)
        db_chunks = []
        for c in chunks_data:
            chunk = models.Chunk(
                source_id=source.id,
                chunk_type=c.unit_type,
                text=c.text,
                page=c.page_no,
                slide_no=c.slide_no,
                start_sec=c.start_sec,
                end_sec=c.end_sec,
                image_path=c.image_path
            )
            db.add(chunk)
            db_chunks.append(chunk)
        db.commit()
        
        source.progress = 60
        db.commit()
        
        # Embed in batches
        batch_size = 32
        for i in range(0, len(db_chunks), batch_size):
            batch = db_chunks[i:i+batch_size]
            texts = [c.text for c in batch]
            embeddings = await loop.run_in_executor(executor, get_embeddings, texts)
            for chunk, emb in zip(batch, embeddings):
                chunk.embedding = emb
        db.commit()
        
        source.progress = 80
        db.commit()
        
        # 4. Structure & Tag
        # Pass 1 & 2: Build hierarchy
        await loop.run_in_executor(executor, build_hierarchy, db_chunks, db, source.course_id)
        
        # Pass 3: Tag
        await loop.run_in_executor(executor, tag_chunks, db_chunks, db, source.course_id)
        
        source.progress = 100
        source.status = "completed"
        db.commit()
        
    except Exception as e:
        logger.error(f"Ingestion failed for source {source_id}: {e}")
        source.status = "failed"
        source.error_message = str(e)
        db.commit()
    finally:
        db.close()

def run_ingestion(source_id: int):
    asyncio.run(run_ingestion_async(source_id))
