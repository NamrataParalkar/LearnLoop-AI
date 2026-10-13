from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import os

router = APIRouter()

@router.get("/media/{source_id}")
def get_media_file(source_id: int, page: int = None, slide: int = None, time: float = None, db: Session = Depends(get_db)):
    source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    file_path = source.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found on server: {file_path}")
        
    media_type = "application/octet-stream"
    if source.source_type == "pdf":
        media_type = "application/pdf"
    elif source.source_type == "pptx":
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    elif source.source_type == "video":
        media_type = "video/mp4"
        
    return FileResponse(file_path, media_type=media_type, filename=os.path.basename(file_path))

@router.get("/sources/{source_id}/status")
def get_source_status(source_id: int, db: Session = Depends(get_db)):
    source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return {
        "id": source.id,
        "status": source.status,
        "progress": source.progress,
        "error": source.error_message
    }

@router.get("/courses/{course_id}/knowledge")
def get_knowledge_tree(course_id: int, db: Session = Depends(get_db)):
    topics = db.query(models.Topic).filter(models.Topic.course_id == course_id, models.Topic.parent_id == None).all()
    tree = []
    for t in topics:
        subtopics = db.query(models.Topic).filter(models.Topic.parent_id == t.id).all()
        sub_tree = []
        for st in subtopics:
            concepts = db.query(models.Concept).filter(models.Concept.topic_id == st.id).all()
            sub_tree.append({
                "id": st.id,
                "name": st.name,
                "concepts": [{"id": c.id, "name": c.name} for c in concepts]
            })
        tree.append({
            "id": t.id,
            "name": t.name,
            "subtopics": sub_tree
        })
    return {"topics": tree}

@router.get("/chunks/{chunk_id}")
def get_chunk(chunk_id: int, db: Session = Depends(get_db)):
    chunk = db.query(models.Chunk).filter(models.Chunk.id == chunk_id).first()
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return {
        "id": chunk.id,
        "text": chunk.text,
        "source_id": chunk.source_id,
        "source_type": chunk.source.source_type if chunk.source else "unknown",
        "page": chunk.page,
        "slide_no": chunk.slide_no,
        "start_sec": chunk.start_sec,
        "end_sec": chunk.end_sec,
        "image_path": chunk.image_path,
        "topic": chunk.topic.name if chunk.topic else None,
        "concept": chunk.concept.name if chunk.concept else None
    }
