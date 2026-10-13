import json
import logging
from typing import List, Dict, Any
from app.config import settings
from llm import generate_structured
import models

logger = logging.getLogger(__name__)

def generate_grounded_answer(query: str, chunks: List[models.Chunk], style: str = "standard") -> Dict[str, Any]:
    with open("prompts/tutor_generation.txt") as f:
        prompt_template = f.read()
        
    context = ""
    for c in chunks:
        context += f"[C{c.id}]\n{c.text}\n\n"
        
    prompt = prompt_template.format(context=context, question=query)
    
    if style != "standard":
        prompt += f"\n\nStyle constraint: {style}"
        
    with open("prompts/tutor_schema.json") as f:
        schema = json.load(f)
        
    for attempt in range(2):
        try:
            result = generate_structured(prompt, schema)
            return result
        except Exception as e:
            logger.error(f"Generation failed (attempt {attempt+1}): {e}")
            
    # Fallback if both fail
    return {
        "answer_parts": [{"text": "Sorry, I could not generate an answer at this time.", "chunk_ids": []}],
        "coverage_note": "System error during generation."
    }
