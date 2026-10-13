def bkt_update(p_known: float, correct: bool, p_learn: float = 0.15, p_slip: float = 0.10, p_guess: float = 0.25, weight: float = 1.0, score: float = None) -> float:
    """
    Computes the standard Bayesian Knowledge Tracing update for p_known.
    
    Args:
        p_known: Prior probability of mastery [0, 1].
        correct: True if the attempt was correct. Ignored if `score` is provided.
        p_learn: Probability of learning the concept in this step.
        p_slip: Probability of answering incorrectly despite knowing it.
        p_guess: Probability of guessing correctly without knowing it.
        weight: Evidence weight [0.5, 1.5], mapping to difficulty (e.g., hard correct moves more than easy correct).
        score: For partial credit [0, 1]. Interpolates between correct and incorrect posteriors.
    
    Returns:
        p_new: The updated probability of mastery [0.01, 0.99].
    """
    # 1. Calculate posterior probabilities
    p_correct = (p_known * (1 - p_slip)) + ((1 - p_known) * p_guess)
    
    if p_correct == 0 or p_correct == 1:
        # Edge case handling to prevent division by zero
        p_post_correct = p_known
        p_post_incorrect = p_known
    else:
        p_post_correct = (p_known * (1 - p_slip)) / p_correct
        p_post_incorrect = (p_known * p_slip) / (1 - p_correct)
    
    # 2. Select posterior based on evidence
    if score is not None:
        p_post = (score * p_post_correct) + ((1 - score) * p_post_incorrect)
    else:
        p_post = p_post_correct if correct else p_post_incorrect
        
    # 3. Apply learning transition
    p_bkt = p_post + (1 - p_post) * p_learn
    
    # 4. Interpolate based on weight (difficulty awareness)
    p_new = p_known + weight * (p_bkt - p_known)
    
    # 5. Clip bounds
    return max(0.01, min(0.99, p_new))
    
def calculate_weight(difficulty: str, correct: bool) -> float:
    """
    Difficulty-aware evidence mapping.
    Correct on hard > correct on easy.
    Wrong on easy > wrong on hard.
    """
    weights = {
        "hard": {"correct": 1.5, "incorrect": 0.5},
        "medium": {"correct": 1.0, "incorrect": 1.0},
        "easy": {"correct": 0.5, "incorrect": 1.5}
    }
    return weights.get(difficulty, weights["medium"])["correct" if correct else "incorrect"]
