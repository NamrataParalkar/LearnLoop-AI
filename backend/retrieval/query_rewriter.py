import re
import logging
from llm import generate_text

logger = logging.getLogger(__name__)

COMMON_TYPOS = {
    r"\bmodle\b": "model",
    r"\boverfiting\b": "overfitting",
    r"\bunderfiting\b": "underfitting",
    r"\bbackpropogation\b": "backpropagation",
    r"\balgoritm\b": "algorithm",
    r"\balgortihm\b": "algorithm",
    r"\bgradient decent\b": "gradient descent",
    r"\bneurel\b": "neural",
}

def clean_typos(text: str) -> str:
    cleaned = text
    for pattern, replacement in COMMON_TYPOS.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    return cleaned

def rewrite_query(current_query: str, chat_history: list) -> str:
    """
    Turns follow-up questions into standalone queries based on history and corrects typos.
    """
    cleaned_query = clean_typos(current_query.strip())
    
    if not chat_history:
        return cleaned_query
        
    prompt = f"""Given the following conversation history and the latest user query, rewrite the user query to be a clear standalone academic search query:
1. Correct any spelling errors or typos in educational terms (e.g. 'modle' -> 'model', 'overfiting' -> 'overfitting').
2. If the user query introduces a NEW topic or concept (e.g., 'model training', 'overfitting', 'quicksort', 'neural networks'), DO NOT combine or contaminate it with previous unrelated topics from the history. Treat it as a standalone topic.
3. Only use the conversation history if the query is an incomplete follow-up or uses pronouns referring back to previous messages (e.g., 'why does it happen?', 'give an example of that', 'explain the trade-offs mentioned above').
4. DO NOT ANSWER THE QUESTION. Only output the rewritten search query text.

Conversation History (last 4 messages):
"""
    recent_history = chat_history[-4:]
    for msg in recent_history:
        prompt += f"{msg['role'].capitalize()}: {msg['content']}\n"
        
    prompt += f"User: {cleaned_query}\n\nRewritten Query:"
    
    try:
        rewritten = generate_text(prompt).strip()
        rewritten = clean_typos(rewritten)
        return rewritten or cleaned_query
    except Exception as e:
        logger.error(f"Query rewrite failed: {e}")
        return cleaned_query
