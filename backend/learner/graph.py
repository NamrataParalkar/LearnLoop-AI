from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models import Mastery, Concept, Prerequisite, Topic
from learner.decay import compute_effective_mastery
from datetime import datetime
import math
import networkx as nx

class LearnerGraph:
    def __init__(self, db: Session, user_id: int, course_id: Optional[int] = None):
        self.db = db
        self.user_id = user_id
        self.course_id = course_id
        
        # Build mastery map for this user
        self.mastery_map = {}
        for m in db.query(Mastery).filter(Mastery.user_id == user_id).all():
            self.mastery_map[m.concept_id] = m
            
        # Retrieve prerequisites, optionally scoped to course
        if course_id:
            course_topic_ids = [t.id for t in db.query(Topic).filter(Topic.course_id == course_id).all()]
            course_concept_ids = set(c.id for c in db.query(Concept).filter(Concept.topic_id.in_(course_topic_ids)).all())
            raw_prereqs = db.query(Prerequisite).filter(
                Prerequisite.concept_id.in_(course_concept_ids),
                Prerequisite.requires_concept_id.in_(course_concept_ids)
            ).all()
        else:
            raw_prereqs = db.query(Prerequisite).all()

        # Build DAG and break any cycles safely
        G = nx.DiGraph()
        if course_id:
            for cid in course_concept_ids:
                G.add_node(cid)
        for p in raw_prereqs:
            G.add_edge(p.requires_concept_id, p.concept_id)

        try:
            cycles = list(nx.simple_cycles(G))
            for cycle in cycles:
                # Remove the feedback edge to maintain acyclic property
                G.remove_edge(cycle[-1], cycle[0])
        except Exception:
            pass

        self.G = G
        self.edges = [
            type("PrereqEdge", (), {"concept_id": v, "requires_concept_id": u})()
            for u, v in G.edges()
        ]

    def get_topological_layers(self) -> Dict[int, int]:
        layers = {}
        try:
            for n in nx.topological_sort(self.G):
                preds = list(self.G.predecessors(n))
                layers[n] = 0 if not preds else max(layers.get(p, 0) + 1 for p in preds)
        except Exception:
            for n in self.G.nodes():
                layers[n] = 0
        return layers

    def get_downstream_blocked_count(self, concept_id: int) -> int:
        if concept_id not in self.G:
            return 0
        descendants = nx.descendants(self.G, concept_id)
        blocked_count = 0
        for d in descendants:
            if self.get_status(d) == "locked":
                blocked_count += 1
        return blocked_count

    def get_bottlenecks(self) -> List[Dict]:
        bottlenecks = []
        for cid in self.G.nodes():
            eff = self.get_effective_mastery(cid)
            if eff < 0.60:
                blocked = self.get_downstream_blocked_count(cid)
                if blocked > 0:
                    c = self.db.query(Concept).filter(Concept.id == cid).first()
                    t = self.db.query(Topic).filter(Topic.id == c.topic_id).first() if c else None
                    bottlenecks.append({
                        "concept_id": cid,
                        "concept_name": c.name if c else f"Concept {cid}",
                        "topic_id": c.topic_id if c else None,
                        "topic_name": t.name if t else "Module",
                        "mastery": int(round(eff * 100)),
                        "blocked_count": blocked,
                        "is_ready": self.is_prerequisite_ready(cid, threshold=0.6)
                    })
        bottlenecks.sort(key=lambda x: (x["blocked_count"], -x["mastery"]), reverse=True)
        return bottlenecks
        
    def get_effective_mastery(self, concept_id: int) -> float:
        m = self.mastery_map.get(concept_id)
        if not m:
            return 0.1 # Default prior
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
        eff = self.get_effective_mastery(concept_id)
        is_ready = self.is_prerequisite_ready(concept_id, threshold=0.6)
        
        # 1. Prerequisite gating: if prerequisites unmet and mastery < 0.6, the concept is locked
        if not is_ready and eff < 0.6:
            return "locked"

        m = self.mastery_map.get(concept_id)
        if not m or m.n_observations == 0:
            return "not_started"
            
        # 2. Memory decay / Spaced revision check
        if m.last_practiced_at:
            days_elapsed = max(0.0, (datetime.utcnow() - m.last_practiced_at).total_seconds() / 86400)
            retention = math.exp(-days_elapsed / max(1.0, m.stability_days))
            if (days_elapsed >= 2 or retention < 0.8) and m.p_known >= 0.5 and eff < 0.75:
                return "revision_required"
        
        if eff >= 0.8:
            return "mastered"
        elif eff >= 0.5:
            return "learning"
        else:
            return "weak"

