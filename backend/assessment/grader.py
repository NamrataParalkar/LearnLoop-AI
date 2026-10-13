import re
import json
import logging
from typing import Dict, Any, Optional, List
from llm import generate_structured
from app.config import settings

logger = logging.getLogger(__name__)

def grade_answer(
    question_type: str,
    user_answer: Any,
    answer_key: Any,
    rubric: Optional[List[str]] = None,
    tolerance: Optional[float] = None,
    stem: Optional[str] = None
) -> Dict[str, Any]:
    """
    Grades student answer based on question type.
    Returns:
        is_correct: bool
        score: float (0.0 to 1.0)
        feedback: str
    """
    if not user_answer or str(user_answer).strip() == "":
        return {
            "is_correct": False,
            "score": 0.0,
            "feedback": f"No answer provided. The correct answer was: {answer_key}"
        }

    user_str = str(user_answer).strip()
    key_str = str(answer_key).strip()

    def clean_opt(s: str) -> str:
        return re.sub(r"^([a-dA-D]\s*[\)\.\:\-]\s*|\s+)", "", s.lower()).strip()

    if question_type in ["mcq", "true_false"]:
        # Letter match check (e.g., 'A' matches 'A) Provably Available Broadcast')
        letter_match = (
            len(user_str) > 0 and len(key_str) > 0 and
            user_str[0].upper() == key_str[0].upper() and
            user_str[0].upper() in "ABCDTF"
        )
        # Full text match
        text_match = clean_opt(user_str) == clean_opt(key_str) or user_str.lower() == key_str.lower()
        
        is_correct = letter_match or text_match
        score = 1.0 if is_correct else 0.0
        if is_correct:
            feedback = "Correct! Well done."
        else:
            feedback = f"Incorrect. Your answer was '{user_str}', but the correct answer is '{key_str}'."
            
        return {
            "is_correct": is_correct,
            "score": score,
            "feedback": feedback
        }

    elif question_type == "multi_select":
        # Handle set comparison
        if isinstance(user_answer, list):
            user_set = {clean_opt(x) for x in user_answer if x}
        else:
            user_set = {clean_opt(x.strip()) for x in str(user_answer).split(",") if x.strip()}

        if isinstance(answer_key, list):
            key_set = {clean_opt(x) for x in answer_key if x}
        else:
            key_set = {clean_opt(x.strip()) for x in str(answer_key).split(",") if x.strip()}

        if not key_set:
            return {"is_correct": True, "score": 1.0, "feedback": "Correct!"}

        intersection = user_set.intersection(key_set)
        jaccard = len(intersection) / len(user_set.union(key_set)) if user_set.union(key_set) else 0.0
        
        is_correct = user_set == key_set
        score = round(jaccard, 2)
        if is_correct:
            feedback = "Correct! All correct options were selected."
        elif score > 0:
            feedback = f"Partially correct (Score: {int(score*100)}%). Expected: {key_str}."
        else:
            feedback = f"Incorrect. The correct options were: {key_str}."

        return {
            "is_correct": is_correct,
            "score": 1.0 if is_correct else score,
            "feedback": feedback
        }

    elif question_type == "short":
        # Semantic LLM grading for short answer
        prompt = f"""You are an expert academic grader.
Evaluate the student's short answer against the question, answer key, and grading rubric.

Question: {stem or "Conceptual question"}
Expected Answer: {key_str}
Rubric criteria: {rubric or ["Factual accuracy", "Conceptual understanding"]}

Student Answer: {user_str}

Evaluate fairly:
- Award full score (1.0) if core technical concepts are addressed correctly.
- Award partial score (0.5 to 0.8) if mostly correct but missing minor detail.
- Award 0.0 if factually wrong or irrelevant.

Return JSON:
{{
  "score": float between 0.0 and 1.0,
  "is_correct": true or false,
  "feedback": "1-2 sentences of helpful feedback"
}}
"""
        schema = {
            "type": "object",
            "properties": {
                "score": {"type": "number"},
                "is_correct": {"type": "boolean"},
                "feedback": {"type": "string"}
            },
            "required": ["score", "is_correct", "feedback"]
        }
        try:
            res = generate_structured(prompt, schema, model_name=settings.verifier_model or "gemini-3.5-flash-lite")
            score = float(res.get("score", 0.0))
            is_correct = bool(res.get("is_correct", score >= 0.7))
            feedback = res.get("feedback", "Graded based on rubric criteria.")
            return {
                "is_correct": is_correct,
                "score": score,
                "feedback": feedback
            }
        except Exception as e:
            logger.error(f"Short answer grading error: {e}")
            # Fallback simple keyword match
            is_correct = key_str.lower() in user_str.lower()
            return {
                "is_correct": is_correct,
                "score": 1.0 if is_correct else 0.5,
                "feedback": "Correct!" if is_correct else f"Expected key points: {key_str}"
            }

    return {"is_correct": False, "score": 0.0, "feedback": "Unknown question type."}
