import os
import sys
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import random

db = SessionLocal()

sources = db.query(models.Source).all()

print("--- INGESTION REPORT ---\n")
for s in sources:
    chunks = db.query(models.Chunk).filter(models.Chunk.source_id == s.id).all()
    text_count = sum(1 for c in chunks if c.chunk_type == 'text')
    fig_count = sum(1 for c in chunks if c.chunk_type == 'figure')
    trans_count = sum(1 for c in chunks if c.chunk_type == 'transcript')
    
    missing_loc = 0
    for c in chunks:
        if s.source_type == 'pdf' and c.page is None:
            missing_loc += 1
        elif s.source_type == 'pptx' and c.slide_no is None:
            missing_loc += 1
        elif s.source_type == 'video' and c.start_sec is None:
            missing_loc += 1
            
    fig_captioned = sum(1 for c in chunks if c.chunk_type == 'figure' and c.figure_caption)
    
    print(f"Source {s.id} ({s.source_type}) - Status: {s.status}")
    print(f"  Chunks: {len(chunks)} total (Text: {text_count}, Figure: {fig_count}, Transcript: {trans_count})")
    print(f"  Missing loc: {missing_loc}")
    print(f"  Figures captioned: {fig_captioned} / {fig_count}")
    print(f"  Processing time: {(s.updated_at - s.created_at).total_seconds():.1f}s")
    print()
    
    print(f"--- Sample Chunks for Source {s.id} ---")
    samples = random.sample(chunks, min(3, len(chunks)))
    for c in samples:
        loc = f"Page {c.page}" if s.source_type == 'pdf' else f"Slide {c.slide_no}" if s.source_type == 'pptx' else f"Time {c.start_sec}-{c.end_sec}"
        print(f"Loc: {loc} | Type: {c.chunk_type} | Text: {c.text[:100]}...")
    print()

print("--- HIERARCHY ---")
topics = db.query(models.Topic).filter(models.Topic.parent_id == None).all()
for t in topics:
    print(f"Topic: {t.name}")
    subtopics = db.query(models.Topic).filter(models.Topic.parent_id == t.id).all()
    for sub in subtopics:
        print(f"  Subtopic: {sub.name}")
        concepts = db.query(models.Concept).filter(models.Concept.topic_id == sub.id).all()
        for c in concepts:
            chunk_count = db.query(models.Chunk).filter(models.Chunk.concept_id == c.id).count()
            print(f"    Concept: {c.name} ({chunk_count} chunks)")

print("\n--- PREREQUISITES ---")
prereqs = db.query(models.Prerequisite).limit(10).all()
for p in prereqs:
    c1 = db.query(models.Concept).get(p.concept_id)
    c2 = db.query(models.Concept).get(p.requires_concept_id)
    if c1 and c2:
        print(f"{c1.name} REQUIRES {c2.name}")

db.close()
