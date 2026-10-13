import json
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

class TestsetBuilder:
    def __init__(self):
        self.file_path = "backend/eval/testset/candidate_testset.json"

    def generate_candidates(self) -> List[Dict]:
        """Generates candidates from DB and saves to file for human review."""
        items = []
        # Mocking generation of 60 in-material, 25 off-material, 10 follow-up
        for i in range(60):
            items.append({
                "id": f"in_{i}", "type": "in_material", 
                "question": "Sample?", "gold_answer": "Yes", 
                "reviewed": False
            })
        
        with open(self.file_path, 'w') as f:
            json.dump(items, f, indent=2)
            
        logger.info(f"Generated {len(items)} candidates. Pending review.")
        return items

    def load_reviewed(self) -> List[Dict]:
        """Loads items, warning if < 80% are reviewed."""
        with open(self.file_path, 'r') as f:
            items = json.load(f)
            
        reviewed = [i for i in items if i.get("reviewed", False)]
        if len(reviewed) / len(items) < 0.8:
            logger.warning("WARNING: Less than 80% of test set items have been human-reviewed!")
            
        return reviewed
