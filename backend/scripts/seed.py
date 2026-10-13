import os
import requests
import time
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_URL = "http://localhost:8000/api"

def seed():
    sample_dir = "../data/sample_course"
    os.makedirs(sample_dir, exist_ok=True)
    
    files = ["sample.pdf", "sample.pptx", "sample.mp4"]
    for f in files:
        path = os.path.join(sample_dir, f)
        if not os.path.exists(path):
            with open(path, "w") as fd:
                fd.write("dummy content")
    
    course_id = 1
    
    # Upload all
    source_ids = []
    for f in files:
        path = os.path.join(sample_dir, f)
        with open(path, "rb") as fd:
            resp = requests.post(
                f"{API_URL}/courses/{course_id}/upload", 
                files={"file": (f, fd)}
            )
            if resp.status_code == 200:
                source_ids.append(resp.json()["source_id"])
                logger.info(f"Uploaded {f}, source_id={source_ids[-1]}")
            else:
                logger.error(f"Failed to upload {f}: {resp.text}")
                
    # Wait for completion
    logger.info("Waiting for ingestion to complete...")
    all_done = False
    while not all_done:
        all_done = True
        for sid in source_ids:
            resp = requests.get(f"{API_URL}/sources/{sid}/status")
            if resp.status_code == 200:
                status = resp.json()["status"]
                progress = resp.json()["progress"]
                logger.info(f"Source {sid} - Status: {status} - Progress: {progress}%")
                if status not in ["completed", "failed"]:
                    all_done = False
        if not all_done:
            time.sleep(5)
            
    # Print report
    db = SessionLocal()
    print("\n" + "="*50)
    print("INGESTION REPORT")
    print("="*50)
    
    chunks = db.query(models.Chunk).all()
    print(f"Total Chunks: {len(chunks)}")
    
    from collections import Counter
    chunk_types = Counter([c.chunk_type for c in chunks])
    print(f"Chunk Types: {dict(chunk_types)}")
    
    untagged = sum(1 for c in chunks if c.topic_id is None)
    print(f"Untagged chunks: {untagged}")
    
    topics = db.query(models.Topic).count()
    concepts = db.query(models.Concept).count()
    prereqs = db.query(models.Prerequisite).count()
    
    print(f"Topics: {topics}")
    print(f"Concepts: {concepts}")
    print(f"Prerequisites: {prereqs}")
    
    print("\n--- Random Chunks (Sample of 5) ---")
    import random
    for c in random.sample(chunks, min(5, len(chunks))):
        print(f"ID: {c.id} | Type: {c.chunk_type} | Src: {c.source_id}")
        if c.page: print(f"  Page: {c.page}")
        if c.slide_no: print(f"  Slide: {c.slide_no}")
        if c.start_sec: print(f"  Time: {c.start_sec} - {c.end_sec}")
        print(f"  Text (first 50 chars): {c.text[:50].replace(chr(10), ' ')}")
    
    db.close()

if __name__ == "__main__":
    seed()
