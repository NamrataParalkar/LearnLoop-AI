import asyncio
import os
import sys
from database import engine, Base
import models
from ingestion.pipeline import run_ingestion_async

def reset_db():
    print("Resetting database...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

async def main():
    reset_db()
    from database import SessionLocal
    db = SessionLocal()
    
    # 1. Create User & Course
    u = models.User(name="Demo User", email="demo@example.com")
    c = models.Course(title="Data Structures")
    db.add(u)
    db.add(c)
    db.commit()
    
    # 2. Add Sources
    s1 = models.Source(course_id=c.id, source_type="pptx", file_path="data/media/lecture_01.pptx", status="pending")
    s2 = models.Source(course_id=c.id, source_type="pdf", file_path="data/media/paper_review.pdf", status="pending")
    s3 = models.Source(course_id=c.id, source_type="video", file_path="data/media/demo_video.mp4", status="pending")
    db.add_all([s1, s2, s3])
    db.commit()
    
    print("Ingesting PPTX...")
    await run_ingestion_async(s1.id)
    print("Ingesting PDF...")
    await run_ingestion_async(s2.id)
    print("Ingesting Video...")
    await run_ingestion_async(s3.id)
    
    print("All done!")

if __name__ == "__main__":
    asyncio.run(main())
