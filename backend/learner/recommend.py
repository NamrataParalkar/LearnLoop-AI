from typing import Optional
from sqlalchemy.orm import Session
from models import Concept, Mastery, Topic
from learner.graph import LearnerGraph
import logging

logger = logging.getLogger(__name__)

def next_best_action(db: Session, user_id: int, course_id: Optional[int] = None) -> dict:
    """
    Pick the concept to focus on combining low mastery and ready prerequisites.
    """
    graph = LearnerGraph(db, user_id, course_id)
    
    if course_id:
        topic_ids = [t.id for t in db.query(Topic).filter(Topic.course_id == course_id).all()]
        concepts = db.query(Concept).filter(Concept.topic_id.in_(topic_ids)).all() if topic_ids else []
    else:
        concepts = db.query(Concept).all()
    
    # 1. High-leverage prerequisite bottlenecks
    bottlenecks = graph.get_bottlenecks()
    for b in bottlenecks:
        if b["is_ready"] and b["blocked_count"] >= 2:
            return {
                "action": "unlock_bottleneck",
                "concept_id": b["concept_id"],
                "concept_name": b["concept_name"],
                "topic_id": b["topic_id"],
                "topic_name": b["topic_name"],
                "reason": f"High Pedagogical Leverage: '{b['concept_name']}' is currently blocking {b['blocked_count']} downstream concepts (mastery is {b['mastery']}%). Mastering this unlocks a major branch of your curriculum."
            }

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
            "reason": "All available concepts in this course are mastered or locked by prerequisites.",
            "concept_id": None,
            "concept_name": None,
            "topic_id": None,
            "topic_name": None
        }
        
    # Sort by lowest mastery first
    candidates.sort(key=lambda x: x["mastery"])
    
    best = candidates[0]
    topic = db.query(Topic).filter(Topic.id == best["concept"].topic_id).first()
    topic_name = topic.name if topic else "Curriculum"
    
    if best["status"] == "revision_required":
        action = "review"
        reason = f"Memory decay detected for '{best['concept'].name}' ({round(best['mastery']*100)}% retention). Spaced review recommended to prevent forgetting."
    elif best["status"] == "not_started":
        action = "learn"
        reason = f"You haven't started '{best['concept'].name}' yet, and all prerequisite foundations are met."
    else:
        action = "practice"
        reason = f"Your mastery on '{best['concept'].name}' is {round(best['mastery']*100)}%. Targeted practice will solidify your understanding."
        
    return {
        "action": action,
        "concept_id": best["concept"].id,
        "concept_name": best["concept"].name,
        "topic_id": best["concept"].topic_id,
        "topic_name": topic_name,
        "reason": reason
    }

