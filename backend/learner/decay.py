import math
from datetime import datetime

def compute_effective_mastery(p_known: float, last_practiced_at: datetime, stability_days: float, floor: float = 0.5) -> float:
    """
    Applies a forgetting curve to mastery based on time elapsed.
    
    Args:
        p_known: True BKT state of mastery.
        last_practiced_at: Datetime of last observation.
        stability_days: Decay constant.
        floor: Lowest ratio of p_known to decay to (default 0.5, meaning it never drops below half its learned peak).
        
    Returns:
        Effective mastery to display to the user.
    """
    if not last_practiced_at:
        return p_known
        
    days_elapsed = max(0.0, (datetime.utcnow() - last_practiced_at).total_seconds() / 86400)
    
    # Retrievability (forgetting curve)
    r = math.exp(-days_elapsed / stability_days)
    
    return p_known * (floor + (1 - floor) * r)

def update_stability(stability_days: float, correct: bool, days_elapsed: float) -> float:
    """
    Grows stability on correct recall, shrinks on failure.
    Spacing effect: Correct recall after a longer gap grows stability more.
    """
    if correct:
        # Increase stability, rewarding longer gaps (spaced repetition effect)
        multiplier = 1.0 + min(1.0, days_elapsed / stability_days)
        new_stability = stability_days * max(1.2, multiplier)
    else:
        # Shrink stability on failure
        new_stability = stability_days * 0.6
        
    return max(1.0, min(60.0, new_stability))
