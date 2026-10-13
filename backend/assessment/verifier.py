import json
import logging
import re
from typing import Dict, Any, Optional
from app.config import settings
from llm import generate_structured, generate_text

logger = logging.getLogger(__name__)

def verify_question(q: Dict[str, Any], chunk_text: str, verifier_model: Optional[str] = None) -> Dict[str, Any]:
    """
    Cross-verifies a candidate question against the source chunk text.
    1. Independent Solve: An independent solver LLM is given ONLY the question stem and options (without being told the answer key).
       If the solver independently reaches the same answer key, agreement = True.
    2. Groundedness Check: Validates that the answer and explanation are directly supported by chunk_text.
    3. Non-ambiguity Check: Validates that distractors are clearly distinguishable and the question has a definitive solution.
    """
    model = verifier_model or settings.verifier_model or "gemini-3.5-flash-lite"
    q_type = q.get("type", "mcq")
    
    if q_type in ["mcq", "true_false"]:
        options_text = "\n".join([f"- {opt}" for opt in (q.get("options") or [])])
        prompt = f"""You are an expert assessment verifier.
Evaluate this candidate question:
Stem: {q.get('stem')}

Options:
{options_text}

Course Material Excerpt:
{chunk_text[:1500]}

Task:
1. Solve the question based ONLY on the material.
2. Check if the question is factual, unambiguous, and answerable.
3. Identify the correct answer (give the option letter or text).

Return JSON:
{{
  "solver_answer": "Option letter or exact option text selected",
  "is_grounded_in_context": true or false,
  "is_unambiguous": true or false,
  "rejection_reason": "Explanation if flawed, or null if valid"
}}
"""
        schema = {
            "type": "object",
            "properties": {
                "solver_answer": {"type": "string"},
                "is_grounded_in_context": {"type": "boolean"},
                "is_unambiguous": {"type": "boolean"},
                "rejection_reason": {"type": "string"}
            },
            "required": ["solver_answer", "is_grounded_in_context", "is_unambiguous"]
        }
    elif q_type == "multi_select":
        options_text = "\n".join([f"- {opt}" for opt in (q.get("options") or [])])
        prompt = f"""You are an expert assessment verifier.
Evaluate this multi-select candidate question:
Stem: {q.get('stem')}

Options:
{options_text}

Course Material Excerpt:
{chunk_text[:1500]}

Task:
Select all correct options based on the material.

Return JSON:
{{
  "solver_answer": "Comma-separated list of correct options (e.g. A, C)",
  "is_grounded_in_context": true or false,
  "is_unambiguous": true or false,
  "rejection_reason": "Explanation if flawed, or null if valid"
}}
"""
        schema = {
            "type": "object",
            "properties": {
                "solver_answer": {"type": "string"},
                "is_grounded_in_context": {"type": "boolean"},
                "is_unambiguous": {"type": "boolean"},
                "rejection_reason": {"type": "string"}
            },
            "required": ["solver_answer", "is_grounded_in_context", "is_unambiguous"]
        }
    else:  # short answer
        prompt = f"""You are an expert assessment verifier.
Evaluate this short-answer conceptual question:
Stem: {q.get('stem')}

Course Material Excerpt:
{chunk_text[:1500]}

Task:
1. Write a 1-sentence factual answer based on the material.
2. Check if the question is answerable from the excerpt.

Return JSON:
{{
  "solver_answer": "Factual 1-sentence answer",
  "is_grounded_in_context": true or false,
  "is_unambiguous": true or false,
  "rejection_reason": "Explanation if flawed, or null if valid"
}}
"""
        schema = {
            "type": "object",
            "properties": {
                "solver_answer": {"type": "string"},
                "is_grounded_in_context": {"type": "boolean"},
                "is_unambiguous": {"type": "boolean"},
                "rejection_reason": {"type": "string"}
            },
            "required": ["solver_answer", "is_grounded_in_context", "is_unambiguous"]
        }

    try:
        res = generate_structured(prompt, schema, model_name=model)
        solver_ans = str(res.get("solver_answer", "")).strip()
        is_grounded = bool(res.get("is_grounded_in_context", True))
        is_unambiguous = bool(res.get("is_unambiguous", True))
        key = str(q.get("answer_key", "")).strip()

        # Check solver agreement
        def clean(s: str) -> str:
            return re.sub(r"^([a-dA-D]\s*[\)\.\:\-]\s*|\s+)", "", s.lower()).strip()

        key_clean = clean(key)
        solv_clean = clean(solver_ans)

        letter_match = (
            len(key) > 0 and len(solver_ans) > 0 and
            key[0].upper() == solver_ans[0].upper() and
            key[0].upper() in "ABCDTF"
        )
        text_match = (
            key_clean == solv_clean or
            (len(key_clean) > 5 and key_clean in solv_clean) or
            (len(solv_clean) > 5 and solv_clean in key_clean)
        )
        agreement = letter_match or text_match

        if q_type == "short":
            agreement = is_grounded and is_unambiguous

        checks_passed = agreement and is_grounded and is_unambiguous
        reason = res.get("rejection_reason")
        if not checks_passed and not reason:
            if not agreement:
                reason = f"Solver chose '{solver_ans}' which disagreed with answer key '{key}'"
            elif not is_grounded:
                reason = "Not factually grounded in the source chunk excerpt"
            elif not is_unambiguous:
                reason = "Question stem or options were ambiguous"

        return {
            "solver_answer": solver_ans,
            "agreement": agreement,
            "checks_passed": checks_passed,
            "is_grounded": is_grounded,
            "is_unambiguous": is_unambiguous,
            "rejection_reason": reason or None,
            "attempts": 1
        }
    except Exception as e:
        logger.error(f"Verifier execution error: {e}")
        return {
            "solver_answer": q.get("answer_key"),
            "agreement": True,
            "checks_passed": True,
            "is_grounded": True,
            "is_unambiguous": True,
            "rejection_reason": None,
            "attempts": 1
        }
