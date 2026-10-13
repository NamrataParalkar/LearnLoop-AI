import json
import logging
from app.config import settings
from retrieval.hybrid import hybrid_search
from retrieval.reranker import rerank_chunks
from database import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calibrate():
    db = SessionLocal()
    course_id = 1
    
    # Dummy questions for calibration if file doesn't exist
    try:
        with open("../data/eval/calibration.json") as f:
            data = json.load(f)
            in_material = data.get("in_material", [])
            off_material = data.get("off_material", [])
    except FileNotFoundError:
        import os
        os.makedirs("../data/eval", exist_ok=True)
        in_material = ["What is the main topic of the first lecture?", "Explain the process of mitosis."]
        off_material = ["What is the capital of France?", "How do you bake a cake?"]
        with open("../data/eval/calibration.json", "w") as f:
            json.dump({"in_material": in_material, "off_material": off_material}, f, indent=4)
            
    in_scores = []
    off_scores = []
    
    logger.info("Running in-material calibration...")
    for q in in_material:
        chunks = hybrid_search(db, q, course_id, top_k=settings.retrieve_top_k)
        if chunks:
            _, _, top_score = rerank_chunks(q, chunks)
            in_scores.append(top_score)
        else:
            in_scores.append(0.0)
            
    logger.info("Running off-material calibration...")
    for q in off_material:
        chunks = hybrid_search(db, q, course_id, top_k=settings.retrieve_top_k)
        if chunks:
            _, _, top_score = rerank_chunks(q, chunks)
            off_scores.append(top_score)
        else:
            off_scores.append(0.0)
            
    print(f"\nIn-Material Scores: {in_scores}")
    print(f"Off-Material Scores: {off_scores}")
    
    # Simple threshold calculation (midpoint between min(in) and max(off))
    # In reality, this requires statistical analysis (e.g. F1 score optimization)
    min_in = min(in_scores) if in_scores else 1.0
    max_off = max(off_scores) if off_scores else 0.0
    
    suggested_threshold = (min_in + max_off) / 2
    print(f"Suggested Threshold: {suggested_threshold:.4f}")
    
    db.close()

if __name__ == "__main__":
    calibrate()
