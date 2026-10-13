from sqlalchemy.orm import Session
from models import Concept, Mastery
from learner.graph import LearnerGraph
import logging

logger = logging.getLogger(__name__)

def next_best_action(db: Session, user_id: int) -> dict:
    """
    Pick the concept to focus on combining low mastery and ready prerequisites.
    """
    graph = LearnerGraph(db, user_id)
    concepts = db.query(Concept).all()
    
    candidates = []
    for c in concepts:
        status = graph.get_status(c.id)
        if status in ["locked", "mastered"]:
            continue
            
        eff = graph.get_effective_mastery(c.id)
        candidates.append({"concept": c, "mastery": eff, "status": status})
        
    if not candidates:
        return {
            "action": "review",
            "reason": "All concepts are mastered or locked.",
            "concept_id": None
        }
        
    # Sort by lowest mastery first
    candidates.sort(key=lambda x: x["mastery"])
    
    best = candidates[0]
    
    if best["status"] == "not_started":
        action = "learn"
        reason = "You haven't started this concept yet, and you are ready for it."
    else:
        action = "practice"
        reason = f"Your mastery is low ({round(best['mastery']*100)}%)."
        
    return {
        "action": action,
        "concept_id": best["concept"].id,
        "topic_id": best["concept"].topic_id,
        "reason": reason
    }
