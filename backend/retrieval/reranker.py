import logging
from typing import List, Tuple
import models
from app.config import settings

logger = logging.getLogger(__name__)

_cross_encoder = None

def get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is None:
        try:
            from sentence_transformers import CrossEncoder
            _cross_encoder = CrossEncoder('BAAI/bge-reranker-base', local_files_only=True)
        except Exception:
            _cross_encoder = None
    return _cross_encoder

def rerank_chunks(query: str, chunks: List[models.Chunk], top_n: int = None) -> Tuple[List[models.Chunk], List[float], float]:
    """
    Reranks chunks. Returns (ranked_chunks, scores, top_score).
    """
    if top_n is None:
        top_n = settings.rerank_top_n
        
    if not chunks:
        return [], [], 0.0
        
    cross_encoder = get_cross_encoder()
    if cross_encoder:
        pairs = [[query, c.text] for c in chunks]
        scores = cross_encoder.predict(pairs)
        # Normalize roughly to 0-1 (sigmoid)
        import math
        def sigmoid(x): return 1 / (1 + math.exp(-x))
        scores = [sigmoid(s) for s in scores]
    else:
        # LLM fallback
        from llm import generate_structured
        schema = {
            "type": "object",
            "properties": {
                "scores": {
                    "type": "array",
                    "items": {"type": "number", "minimum": 0, "maximum": 1}
                }
            },
            "required": ["scores"]
        }
        prompt = f"Rate the relevance of these text chunks to the query '{query}' from 0.0 to 1.0.\n\n"
        for i, c in enumerate(chunks):
            prompt += f"Chunk {i}: {c.text[:200]}...\n"
        try:
            result = generate_structured(prompt, schema)
            scores = result.get("scores", [0.0] * len(chunks))
            if len(scores) != len(chunks):
                scores = [0.0] * len(chunks)
        except Exception as e:
            logger.error(f"LLM reranker failed: {e}")
            scores = [0.0] * len(chunks)
            
    # Sort
    scored_chunks = list(zip(chunks, scores))
    scored_chunks.sort(key=lambda x: x[1], reverse=True)
    
    top_chunks = [sc[0] for sc in scored_chunks[:top_n]]
    top_scores = [sc[1] for sc in scored_chunks[:top_n]]
    max_score = top_scores[0] if top_scores else 0.0
    
    return top_chunks, top_scores, max_score
