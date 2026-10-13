import logging
import json
from database import SessionLocal
from models import User, Course, Topic, Concept, LearnerProfile, Mastery, MasteryEvent
from learner.updater import apply_attempts
from app.routers.quiz import api_submit_quiz, SubmitQuizReq, SubmitAnswerReq
from assessment.generator import generate_quiz
from learner.recommend import next_best_action

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_db(db):
    user = db.query(User).filter(User.id == 99).first()
    if not user:
        user = User(id=99, name="Test User", email="test99@example.com")
        db.add(user)
        db.commit()
    
    course = db.query(Course).filter(Course.id == 1).first()
    if not course:
        course = Course(id=1, title="Test Course")
        db.add(course)
        db.commit()
        
    topic = db.query(Topic).filter(Topic.id == 1).first()
    if not topic:
        topic = Topic(id=1, course_id=1, name="Test Topic")
        db.add(topic)
        db.commit()
        
    concept = db.query(Concept).filter(Concept.id == 1).first()
    if not concept:
        concept = Concept(id=1, topic_id=1, name="Test Concept")
        db.add(concept)
        db.commit()
        
    return user, course, topic, concept

def run_learner_smoke_test():
    db = SessionLocal()
    user, course, topic, concept = setup_db(db)
    
    print("="*50)
    print("LEARNER MODEL SMOKE TEST")
    print("="*50)
    
    # 1. Cold start overview
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == user.id).first()
    if not profile:
        profile = LearnerProfile(user_id=user.id, onboarding_state="new")
        db.add(profile)
        db.commit()
        
    print(f"Cold Start Onboarding State: {profile.onboarding_state}")
    recommendation = next_best_action(db, user.id)
    print(f"Initial Recommendation: {recommendation}")
    
    # 2. Simulate diagnostic & learning via 3 quizzes
    print("\nSimulating 3 quizzes to demonstrate mastery updates...")
    
    for i in range(3):
        # Generate Quiz
        scope = {"topic_ids": [topic.id], "concept_ids": [concept.id]}
        session = generate_quiz(course.id, scope, "medium", 2, ["mcq", "mcq"], user.id)
        
        # Submit Quiz
        # Scripted answers: mostly correct to show rising trajectory
        from models import QuizItem, Question
        items = db.query(QuizItem).filter(QuizItem.session_id == session.id).all()
        
        answers = []
        for item in items:
            q = db.query(Question).filter(Question.id == item.question_id).first()
            # 80% correct simulation
            ans = q.answer_key if (i * 2 + item.position) % 5 != 0 else "Wrong"
            
            answers.append(SubmitAnswerReq(
                question_id=q.id,
                answer=ans,
                confidence=3, # Confident
                time_taken_sec=15
            ))
            
        req = SubmitQuizReq(answers=answers)
        # This will call apply_attempts internally
        api_submit_quiz(session.id, req, db)
        
        # 3. Print trajectory step
        mastery = db.query(Mastery).filter(Mastery.user_id == user.id, Mastery.concept_id == concept.id).first()
        print(f"After Quiz {i+1}: p_known={mastery.p_known:.4f}, n_obs={mastery.n_observations}")
        
    print("\nMastery Trajectory (Events):")
    events = db.query(MasteryEvent).filter(MasteryEvent.user_id == user.id, MasteryEvent.concept_id == concept.id).all()
    for ev in events:
        print(f"  Event {ev.id}: Correct={ev.correct}, p_before={ev.p_before:.4f}, p_after={ev.p_after:.4f}, mismatch={ev.confidence_mismatch}")
        
    print("\nFinal Recommendation:")
    print(next_best_action(db, user.id))
    
    db.close()

if __name__ == "__main__":
    run_learner_smoke_test()
