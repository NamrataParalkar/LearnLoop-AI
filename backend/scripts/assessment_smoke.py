import json
import logging
from database import SessionLocal
from assessment.generator import generate_quiz
from app.routers.quiz import api_submit_quiz, SubmitQuizReq, SubmitAnswerReq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_assessment_smoke_test():
    db = SessionLocal()
    course_id = 1
    user_id = 1
    
    print("="*50)
    print("EVALUATION SMOKE TEST: ADAPTIVE ASSESSMENT")
    print("="*50)
    
    # 1. Generate Quiz
    logger.info("Generating Quiz...")
    scope = {"topic_ids": [1], "concept_ids": []}
    session = generate_quiz(course_id, scope, "medium", 3, ["mcq", "short", "numerical"], user_id)
    
    print(f"Generated Session ID: {session.id}")
    
    # 2. Simulate submission
    logger.info("Simulating user submission...")
    # Fetch questions
    # In reality, fetch from API endpoint. We mock it here.
    from models import QuizItem, Question
    items = db.query(QuizItem).filter(QuizItem.session_id == session.id).all()
    
    answers = []
    for item in items:
        q = db.query(Question).filter(Question.id == item.question_id).first()
        if q.type == "mcq":
            ans = "A" # Correct answer
        elif q.type == "short":
            ans = "Point 1 and Point 2" # Correct
        elif q.type == "numerical":
            ans = "12" # Wrong answer intentionally
        else:
            ans = "Unknown"
            
        answers.append(SubmitAnswerReq(
            question_id=q.id,
            answer=ans,
            confidence=3,
            time_taken_sec=30
        ))
        
    req = SubmitQuizReq(answers=answers)
    result = api_submit_quiz(session.id, req, db)
    
    print(f"Submission Results:")
    for res in result["results"]:
        print(f"  Q ID {res['question_id']}: Correct={res['is_correct']}, Feedback: {res['feedback']}")
        
    # 3. Report
    from models import AssessmentReport
    report = db.query(AssessmentReport).filter(AssessmentReport.session_id == session.id).first()
    print(f"\nAssessment Report:")
    print(json.dumps(report.summary, indent=2))
    
    db.close()

if __name__ == "__main__":
    run_assessment_smoke_test()
