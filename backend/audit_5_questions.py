import json
from database import SessionLocal
from models import Question, Chunk, Source, QuizSession, QuizItem

db = SessionLocal()
session_id = 4
items = db.query(QuizItem).filter(QuizItem.session_id == session_id).all()

for i, item in enumerate(items[:5]):
    q = db.query(Question).filter(Question.id == item.question_id).first()
    chunk_ids = q.source_chunk_ids or []
    chunks = db.query(Chunk).filter(Chunk.id.in_(chunk_ids)).all() if chunk_ids else []
    
    print("=" * 80)
    print(f"QUESTION {i+1} [ID: {q.id}]")
    print(f"Stem: {q.stem}")
    print(f"Type: {q.type.upper()} | Difficulty: {q.difficulty.upper()}")
    print(f"Options: {q.options}")
    print(f"Answer Key: {q.answer_key}")
    print(f"Explanation: {q.explanation}")
    print(f"Source Location Dict: {q.source_location}")
    print(f"Chunk IDs: {chunk_ids}")
    for c in chunks:
        src = db.query(Source).filter(Source.id == c.source_id).first()
        loc = f"Slide {c.slide_no}" if c.slide_no is not None else f"Page {c.page}"
        print(f"--- Chunk {c.id} from {src.file_path if src else 'N/A'} ({loc}) ---")
        print(c.text.strip())
