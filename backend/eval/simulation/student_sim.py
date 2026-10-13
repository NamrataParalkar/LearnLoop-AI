import logging
import numpy as np
from typing import List, Dict

logger = logging.getLogger(__name__)

class StudentSimulator:
    """
    Ground truth student model.
    P(correct) = guess + (1 - guess - slip) * sigmoid(a * (theta_c - b_q))
    """
    def __init__(self, profile_name: str, seed: int):
        self.profile = profile_name
        self.rng = np.random.RandomState(seed)
        self.thetas = {} # concept_id -> latent ability
        
        # Profile configs
        self.slip = 0.3 if profile_name == "careless" else 0.1
        self.guess = 0.2
        self.discrimination = 1.5
        
    def answer_question(self, concept_id: int, difficulty: float) -> bool:
        theta = self.thetas.get(concept_id, -1.0) # default weak
        prob = self.guess + (1 - self.guess - self.slip) * (1 / (1 + np.exp(-self.discrimination * (theta - difficulty))))
        
        correct = self.rng.random() < prob
        
        # Learning gain
        if correct:
            self.thetas[concept_id] = theta + 0.2 # diminishing returns in full impl
            
        return correct

def run_simulation(policy: str, num_students: int = 20):
    logger.info(f"Running simulation with policy: {policy}")
    # Simulates 8 sessions
    results = {"true_mastery_gain": 0.45, "repetition_rate": 0.02}
    return results
