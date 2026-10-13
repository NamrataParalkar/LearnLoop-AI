import json
from typing import List, Dict, Any, Tuple
from app.config import settings
from llm import generate_structured
import models

def check_refusal(query: str, chunks: List[models.Chunk], top_score: float) -> Tuple[str, Dict[str, Any]]:
    """
    Two-stage gate:
    1. Score gate
    2. Sufficiency check with LLM
    Returns (status, sufficiency_result)
    status: "ok", "not_in_material", "partial"
    """
    if top_score < settings.refusal_score_threshold:
        return "not_in_material", {"coverage": "none", "supporting_chunk_ids": [], "missing": "Score below threshold."}
        
    # Build context blocks
    context = ""
    for i, c in enumerate(chunks):
        context += f"[C{c.id}]\n{c.text}\n\n"
        
    prompt = f"Question: {query}\n\nContext:\n{context}\n\nDoes the context provide enough information to answer the question? Check coverage as 'full', 'partial', or 'none'. List supporting chunk IDs (e.g. ['C1']). If partial or none, describe what is missing."
    
    with open("prompts/sufficiency_schema.json") as f:
        schema = json.load(f)
        
    try:
        # Use verifier model
        result = generate_structured(prompt, schema, model_name=settings.verifier_model)
        coverage = result.get("coverage", "none")
        if coverage == "none":
            return "not_in_material", result
        elif coverage == "partial":
            return "partial", result
        else:
            return "ok", result
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Sufficiency check failed: {e}")
        # Fallback open
        return "ok", {"coverage": "full", "supporting_chunk_ids": [f"C{c.id}" for c in chunks], "missing": ""}
