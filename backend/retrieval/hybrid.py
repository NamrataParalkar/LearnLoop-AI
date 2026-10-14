import logging
import json
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from ingestion.pipeline import get_embeddings
import models

logger = logging.getLogger(__name__)

def hybrid_search(db: Session, query: str, course_id: int, topic_id: Optional[int] = None, source_id: Optional[int] = None, top_k: int = None) -> List[models.Chunk]:
    if top_k is None:
        top_k = settings.retrieve_top_k
        
    query_embedding = get_embeddings([query])[0]
    
    # 1. Vector Search
    vector_sql = """
        SELECT c.id, 1 - (c.embedding <=> CAST(:embedding AS vector)) AS vector_score
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.course_id = :course_id
    """
    params = {"embedding": f"[{','.join(map(str, query_embedding))}]", "course_id": course_id}
    if source_id:
        vector_sql += " AND c.source_id = :source_id"
        params["source_id"] = source_id
    elif topic_id:
        vector_sql += " AND c.topic_id = :topic_id"
        params["topic_id"] = topic_id
    
    vector_sql += f" ORDER BY vector_score DESC LIMIT {top_k * 2}"
    
    # 2. Keyword Search (tsvector + ILIKE token fallback)
    keyword_sql = """
        SELECT c.id, ts_rank(to_tsvector('english', c.text), plainto_tsquery('english', :query)) AS text_score
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.course_id = :course_id AND to_tsvector('english', c.text) @@ plainto_tsquery('english', :query)
    """
    keyword_params = {"query": query, "course_id": course_id}
    if source_id:
        keyword_sql += " AND c.source_id = :source_id"
        keyword_params["source_id"] = source_id
    elif topic_id:
        keyword_sql += " AND c.topic_id = :topic_id"
        keyword_params["topic_id"] = topic_id
        
    keyword_sql += f" ORDER BY text_score DESC LIMIT {top_k * 2}"
    
    try:
        vector_results = db.execute(text(vector_sql), params).fetchall()
    except Exception as e:
        logger.warning(f"Vector search failed: {e}. Rolling back sub-transaction.")
        db.rollback()
        vector_results = []
        
    try:
        keyword_results = db.execute(text(keyword_sql), keyword_params).fetchall()
    except Exception as e:
        logger.warning(f"Keyword search failed: {e}. Rolling back sub-transaction.")
        db.rollback()
        keyword_results = []
        
    # If tsvector had no matches, perform fast ILIKE token matching
    if not keyword_results:
        tokens = [t.strip() for t in query.split() if len(t.strip()) > 3]
        if tokens:
            ilike_conditions = " OR ".join([f"c.text ILIKE :t_{i}" for i in range(len(tokens))])
            ilike_sql = f"""
                SELECT c.id, 1.0 AS text_score
                FROM chunks c
                JOIN sources s ON c.source_id = s.id
                WHERE s.course_id = :course_id AND ({ilike_conditions})
            """
            ilike_params = {"course_id": course_id}
            if source_id:
                ilike_sql += " AND c.source_id = :source_id"
                ilike_params["source_id"] = source_id
            for i, tok in enumerate(tokens):
                ilike_params[f"t_{i}"] = f"%{tok}%"
            ilike_sql += f" LIMIT {top_k}"
            try:
                keyword_results = db.execute(text(ilike_sql), ilike_params).fetchall()
            except Exception as e:
                db.rollback()
    
    # RRF (Reciprocal Rank Fusion)
    rrf_k = 60
    scores = {}
    
    for rank, row in enumerate(vector_results):
        chunk_id = row[0]
        scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (rrf_k + rank + 1)
        
    for rank, row in enumerate(keyword_results):
        chunk_id = row[0]
        scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (rrf_k + rank + 1)
        
    sorted_chunk_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:top_k]
    
    if not sorted_chunk_ids:
        # Fallback: return up to top_k chunks from the source/course
        fallback_query = db.query(models.Chunk).join(models.Source).filter(models.Source.course_id == course_id)
        if source_id:
            fallback_query = fallback_query.filter(models.Chunk.source_id == source_id)
        return fallback_query.limit(top_k).all()
        
    # Fetch hydrated chunks in correct order
    chunks = db.query(models.Chunk).filter(models.Chunk.id.in_(sorted_chunk_ids)).all()
    chunk_map = {c.id: c for c in chunks}
    
    return [chunk_map[cid] for cid in sorted_chunk_ids if cid in chunk_map]

