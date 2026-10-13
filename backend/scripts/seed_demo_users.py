import logging
from database import SessionLocal
from models import User, Course, Topic, Concept, LearnerProfile, Mastery, MasteryEvent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_users():
    db = SessionLocal()
    
    # 1. Aarav (Strong, 1 weak topic)
    aarav = User(id=101, name="Aarav", email="aarav@test.com")
    db.merge(aarav)
    
    # 2. Meera (Mid-level, improving)
    meera = User(id=102, name="Meera", email="meera@test.com")
    db.merge(meera)
    
    # 3. New Student (No history)
    new_student = User(id=103, name="New Student", email="new@test.com")
    db.merge(new_student)
    
    db.commit()
    
    # Generate mock concepts
    concept_strong = Concept(id=10, topic_id=1, name="Trees")
    concept_weak = Concept(id=11, topic_id=1, name="Dynamic Programming")
    db.merge(concept_strong)
    db.merge(concept_weak)
    db.commit()
    
    # Seed Aarav's mastery manually for demo speed (bypassing full attempt loop for brevity)
    db.merge(LearnerProfile(user_id=101, onboarding_state="active"))
    db.merge(Mastery(user_id=101, concept_id=10, p_known=0.85, n_observations=12))
    db.merge(Mastery(user_id=101, concept_id=11, p_known=0.42, n_observations=6))
    
    # Seed Meera
    db.merge(LearnerProfile(user_id=102, onboarding_state="active"))
    db.merge(Mastery(user_id=102, concept_id=10, p_known=0.65, n_observations=8))
    
    # Seed New Student
    db.merge(LearnerProfile(user_id=103, onboarding_state="new"))
    
    db.commit()
    logger.info("Demo users seeded successfully.")
    
    # Print out summary
    logger.info("Aarav: Active, Strong Trees (85%), Weak DP (42%)")
    logger.info("Meera: Active, Learning Trees (65%)")
    logger.info("New Student: New onboarding flow")
    
    db.close()

if __name__ == "__main__":
    seed_users()
