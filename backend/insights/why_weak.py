import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class RootCauseAnalyzer:
    def analyze_weakness(self, user_id: int, concept_id: int, evidence_bundle: Dict) -> Dict:
        """
        Rules-based engine to determine the root cause of weakness before asking the LLM to summarize.
        """
        causes = []
        
        # Rule 1: Prerequisite Gap
        prereqs = evidence_bundle.get("prerequisites", [])
        weak_prereqs = [p for p in prereqs if p["p_known"] < 0.6]
        if weak_prereqs:
            causes.append({
                "type": "prerequisite_gap",
                "explanation": f"You are struggling with prerequisites like {weak_prereqs[0]['name']}",
                "evidence": [f"prereq_{weak_prereqs[0]['id']}"]
            })
            
        # Rule 2: Active Misconception
        misconceptions = evidence_bundle.get("misconceptions", [])
        if misconceptions:
            causes.append({
                "type": "active_misconception",
                "explanation": "You frequently confuse this concept with another.",
                "evidence": [m["id"] for m in misconceptions]
            })
            
        # Rule 3: Careless Errors (High slip on easy questions)
        attempts = evidence_bundle.get("attempts", [])
        easy_wrong = [a for a in attempts if a["difficulty"] == "easy" and not a["correct"]]
        if len(easy_wrong) >= 2:
            causes.append({
                "type": "careless_errors",
                "explanation": "You are making mistakes on fundamental questions despite knowing advanced ones.",
                "evidence": [a["id"] for a in easy_wrong]
            })
            
        # LLM formats this into friendly JSON
        return {
            "summary": "You are missing a foundational prerequisite.",
            "causes": causes,
            "recommended_steps": [
                {"action": "learn", "concept_id": weak_prereqs[0]["id"] if weak_prereqs else concept_id, "why": "Build the foundation first."}
            ]
        }
