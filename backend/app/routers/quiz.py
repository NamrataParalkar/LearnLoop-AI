from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime
from assessment.generator import generate_quiz
from assessment.grader import grade_answer
from assessment.report import generate_report
from learner.updater import apply_attempts
from models import QuizSession, QuizItem, Question, Attempt, AssessmentReport, Concept, Topic

router = APIRouter(prefix="/quiz", tags=["Quiz"])

class GenerateQuizReq(BaseModel):
    course_id: int
    scope: Optional[Dict[str, Any]] = {}
    difficulty: str = "medium"
    num_questions: int = 10
    types: Optional[List[str]] = ["mcq"]
    mode: str = "practice"
    time_limit_sec: Optional[int] = None

class SubmitAnswerItem(BaseModel):
    question_id: int
    answer: str
    confidence: Optional[int] = 3
    time_taken_sec: Optional[int] = 10

class CheckAnswerReq(BaseModel):
    question_id: int
    answer: str
    confidence: Optional[int] = 3

class SubmitQuizReq(BaseModel):
    answers: List[SubmitAnswerItem]

@router.post("/generate")
def api_generate_quiz(req: GenerateQuizReq, db: Session = Depends(get_db)):
    """Generates a dynamic source-grounded quiz."""
    try:
        session = generate_quiz(
            db=db,
            course_id=req.course_id,
            scope=req.scope or {},
            difficulty=req.difficulty,
            num_questions=req.num_questions,
            q_types=req.types or ["mcq"],
            user_id=1, # Demo user
            mode=req.mode,
            time_limit_sec=req.time_limit_sec
        )
        debug_stats = session.scope.get("debug_stats", {}) if session.scope else {}
        return {
            "session_id": session.id,
            "status": session.status,
            "mode": session.mode,
            "time_limit_sec": session.time_limit_sec,
            "num_questions": session.num_questions,
            "debug_stats": debug_stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@router.get("/{session_id}")
def api_get_quiz(session_id: int, db: Session = Depends(get_db)):
    """
    Returns questions for the quiz runner.
    SECURITY CHECK: Answer keys and explanations are strictly omitted!
    """
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    items = db.query(QuizItem).filter(QuizItem.session_id == session_id).order_by(QuizItem.position).all()
    questions = []
    for item in items:
        q = db.query(Question).filter(Question.id == item.question_id).first()
        if q:
            topic = db.query(Topic).filter(Topic.id == q.topic_id).first() if q.topic_id else None
            concept = db.query(Concept).filter(Concept.id == q.concept_id).first() if q.concept_id else None
            
            # Answer key, explanation, and rubric are strictly omitted before submission!
            questions.append({
                "id": q.id,
                "position": item.position,
                "type": q.type,
                "difficulty": q.difficulty,
                "stem": q.stem,
                "options": q.options,
                "topic_name": topic.name if topic else "Distributed Systems",
                "concept_name": concept.name if concept else "Blockchain Consensus"
            })
            
    return {
        "session_id": session_id,
        "course_id": session.course_id,
        "mode": session.mode,
        "difficulty": session.difficulty,
        "time_limit_sec": session.time_limit_sec,
        "status": session.status,
        "questions": questions,
        "debug_stats": session.scope.get("debug_stats") if session.scope else {}
    }

@router.post("/{session_id}/check_answer")
def api_check_answer(session_id: int, req: CheckAnswerReq, db: Session = Depends(get_db)):
    """
    Practice mode: check answer for a single question after answering, revealing the source badge.
    """
    q = db.query(Question).filter(Question.id == req.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    grade = grade_answer(
        question_type=q.type,
        user_answer=req.answer,
        answer_key=q.answer_key,
        rubric=q.rubric,
        tolerance=q.numeric_tolerance,
        stem=q.stem
    )

    return {
        "question_id": q.id,
        "is_correct": grade["is_correct"],
        "score": grade["score"],
        "feedback": grade["feedback"],
        "correct_answer": q.answer_key,
        "explanation": q.explanation,
        "source_location": q.source_location or {}
    }

@router.post("/{session_id}/submit")
def api_submit_quiz(session_id: int, req: SubmitQuizReq, db: Session = Depends(get_db)):
    """
    Submits the entire quiz, updates BKT mastery, and generates AssessmentReport.
    """
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Clear any previous attempts for this session
    db.query(Attempt).filter(Attempt.session_id == session_id).delete()
    db.commit()

    results = []
    for ans in req.answers:
        q = db.query(Question).filter(Question.id == ans.question_id).first()
        if not q:
            continue
            
        grade = grade_answer(
            question_type=q.type,
            user_answer=ans.answer,
            answer_key=q.answer_key,
            rubric=q.rubric,
            tolerance=q.numeric_tolerance,
            stem=q.stem
        )
        
        attempt = Attempt(
            user_id=session.user_id,
            question_id=q.id,
            session_id=session_id,
            answer=ans.answer,
            is_correct=grade["is_correct"],
            score=grade["score"],
            time_taken_sec=ans.time_taken_sec or 15,
            confidence=ans.confidence or 3,
            feedback=grade["feedback"]
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        
        results.append({
            "question_id": q.id,
            "is_correct": grade["is_correct"],
            "score": grade["score"],
            "feedback": grade["feedback"]
        })
        
    session.status = "submitted"
    session.submitted_at = datetime.utcnow()
    db.commit()
    
    # 1. Update Learner BKT Model
    try:
        apply_attempts(db, session_id)
    except Exception as e:
        print(f"Error applying BKT attempts: {e}")
        
    # 2. Generate Assessment Report
    report = generate_report(db, session_id)
    
    return {
        "message": "Submitted successfully",
        "session_id": session_id,
        "report": report.summary if report else {}
    }

@router.get("/{session_id}/report")
def api_get_report(session_id: int, db: Session = Depends(get_db)):
    """Returns the comprehensive quiz report."""
    report = db.query(AssessmentReport).filter(AssessmentReport.session_id == session_id).first()
    if not report:
        attempts = db.query(Attempt).filter(Attempt.session_id == session_id).all()
        if attempts:
            report = generate_report(db, session_id)
            return report.summary
        raise HTTPException(status_code=404, detail="Report not found")
        
    return report.summary
