from llm import generate_text
import logging

logger = logging.getLogger(__name__)

def rewrite_query(current_query: str, chat_history: list) -> str:
    """
    Turns follow-up questions into standalone queries based on history.
    history is a list of {"role": "user|assistant", "content": "..."}
    """
    if not chat_history:
        return current_query
        
    # Fast LLM call
    prompt = f"""Given the following conversation history and the latest user query, rewrite the user query to be a standalone question that can be understood without the history. If the query is already standalone, just return the query exactly as is. DO NOT ANSWER THE QUESTION. Only return the rewritten query text.

Conversation History (last 4 messages):
"""
    recent_history = chat_history[-4:]
    for msg in recent_history:
        prompt += f"{msg['role'].capitalize()}: {msg['content']}\n"
        
    prompt += f"User: {current_query}\n\nRewritten Query:"
    
    try:
        rewritten = generate_text(prompt).strip()
        return rewritten
    except Exception as e:
        logger.error(f"Query rewrite failed: {e}")
        return current_query
