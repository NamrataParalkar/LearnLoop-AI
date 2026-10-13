from typing import List, Dict
from sqlalchemy.orm import Session
from models import Mastery, Concept, Prerequisite
from learner.decay import compute_effective_mastery
from datetime import datetime

class LearnerGraph:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        
        # Build map
        self.mastery_map = {}
        for m in db.query(Mastery).filter(Mastery.user_id == user_id).all():
            self.mastery_map[m.concept_id] = m
            
        self.edges = db.query(Prerequisite).all()
        
    def get_effective_mastery(self, concept_id: int) -> float:
        m = self.mastery_map.get(concept_id)
        if not m:
            return 0.1 # Prior
        return compute_effective_mastery(m.p_known, m.last_practiced_at, m.stability_days)

    def is_prerequisite_ready(self, concept_id: int, threshold: float = 0.6) -> bool:
        # Find all direct prerequisites
        reqs = [e.requires_concept_id for e in self.edges if e.concept_id == concept_id]
        if not reqs:
            return True
            
        for req_id in reqs:
            if self.get_effective_mastery(req_id) < threshold:
                return False
        return True
        
    def get_status(self, concept_id: int) -> str:
        m = self.mastery_map.get(concept_id)
        if not m or m.n_observations == 0:
            return "not_started"
            
        eff = self.get_effective_mastery(concept_id)
        
        if not self.is_prerequisite_ready(concept_id) and eff < 0.5:
            return "locked"
        elif eff >= 0.8:
            return "mastered"
        elif eff >= 0.5:
            return "learning"
        else:
            return "weak"
