import json
from sentence_transformers import util

DEDUPE_THRESHOLD = 0.88 # Configurable threshold

def is_duplicate(new_embedding, existing_embeddings):
    """
    Check if the new embedding is a duplicate based on existing embeddings.
    """
    if not existing_embeddings:
        return False
        
    # Assuming embeddings are PyTorch tensors or convertable lists
    scores = util.cos_sim(new_embedding, existing_embeddings)
    max_score = scores.max().item()
    
    return max_score > DEDUPE_THRESHOLD
