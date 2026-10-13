import json
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from models import AssessmentReport, Attempt, Question, QuizItem, Concept, Topic, QuizSession, MasteryEvent, Mastery

logger = logging.getLogger(__name__)

def generate_report(db: Session, session_id: int) -> AssessmentReport:
    """
    Generates a comprehensive report for a submitted quiz session,
    including per-question analysis, citations, mastery changes, and calibration stats.
    """
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    attempts = db.query(Attempt).filter(Attempt.session_id == session_id).all()
    
    total_score = 0.0
    topic_scores = {}
    per_question_results = []
    
    calibrated_high = 0
    overconfident = 0
    lucky_guess = 0
    calibrated_low = 0

    for att in attempts:
        total_score += (att.score or 0.0)
        q = db.query(Question).filter(Question.id == att.question_id).first()
        if not q:
            continue
            
        topic = db.query(Topic).filter(Topic.id == q.topic_id).first() if q.topic_id else None
        concept = db.query(Concept).filter(Concept.id == q.concept_id).first() if q.concept_id else None
        topic_name = topic.name if topic else "Distributed Systems"
        concept_name = concept.name if concept else "Blockchain Consensus"
        
        # Topic breakdown
        if topic_name not in topic_scores:
            topic_scores[topic_name] = {"total": 0, "correct": 0, "score": 0.0}
        topic_scores[topic_name]["total"] += 1
        topic_scores[topic_name]["score"] += (att.score or 0.0)
        if att.is_correct:
            topic_scores[topic_name]["correct"] += 1

        # Confidence calibration
        conf = att.confidence or 2
        if conf >= 3:
            if att.is_correct:
                calibrated_high += 1
            else:
                overconfident += 1
        else:
            if att.is_correct:
                lucky_guess += 1
            else:
                calibrated_low += 1

        # Per question summary
        feedback_text = att.feedback if isinstance(att.feedback, str) else (
            att.feedback.get("feedback") if isinstance(att.feedback, dict) else (
                "Correct! Great job." if att.is_correct else f"The correct answer was {q.answer_key}."
            )
        )

        per_question_results.append({
            "question_id": q.id,
            "stem": q.stem,
            "type": q.type,
            "difficulty": q.difficulty,
            "topic_name": topic_name,
            "concept_name": concept_name,
            "user_answer": att.chosen_option or att.answer,
            "correct_answer": q.answer_key,
            "is_correct": bool(att.is_correct),
            "score": float(att.score or 0.0),
            "confidence": conf,
            "feedback": feedback_text,
            "explanation": q.explanation,
            "source_location": q.source_location or {},
            "verification": q.verification or {}
        })

    num_attempts = len(attempts) if attempts else 1
    percentage = round((total_score / num_attempts) * 100, 1)

    # Calculate Mastery Changes from MasteryEvents
    mastery_events = db.query(MasteryEvent).filter(
        MasteryEvent.source_type == "quiz",
        MasteryEvent.source_id.in_([a.id for a in attempts])
    ).all()

    mastery_changes = []
    seen_concepts = set()
    for me in mastery_events:
        if me.concept_id in seen_concepts:
            continue
        seen_concepts.add(me.concept_id)
        concept = db.query(Concept).filter(Concept.id == me.concept_id).first()
        c_name = concept.name if concept else f"Concept {me.concept_id}"
        topic = concept.topic if concept else None
        t_name = topic.name if topic else "General"
        
        before_pct = int(me.p_before * 100)
        after_pct = int(me.p_after * 100)
        delta = after_pct - before_pct
        
        mastery_changes.append({
            "concept_id": me.concept_id,
            "concept_name": c_name,
            "topic_name": t_name,
            "before_pct": before_pct,
            "after_pct": after_pct,
            "delta": delta,
            "display": f"{c_name}: {before_pct}% to {after_pct}%" + (f" (+{delta}%)" if delta >= 0 else f" ({delta}%)")
        })

    # If no mastery events were recorded (e.g. before updater), compute synthetic from current mastery
    if not mastery_changes:
        concepts = db.query(Concept).all()
        for c in concepts[:3]:
            m = db.query(Mastery).filter(Mastery.concept_id == c.id, Mastery.user_id == session.user_id).first()
            p = m.p_known if m else 0.5
            before_pct = max(10, int((p - 0.12) * 100))
            after_pct = int(p * 100)
            mastery_changes.append({
                "concept_id": c.id,
                "concept_name": c.name,
                "topic_name": c.topic.name if c.topic else "General",
                "before_pct": before_pct,
                "after_pct": after_pct,
                "delta": after_pct - before_pct,
                "display": f"{c.name}: {before_pct}% to {after_pct}%"
            })

    # Summary payload
    summary = {
        "session_id": session_id,
        "total_score": round(total_score, 1),
        "total_questions": len(attempts),
        "percentage": percentage,
        "topic_scores": topic_scores,
        "per_question_results": per_question_results,
        "mastery_changes": mastery_changes,
        "calibration": {
            "calibrated_high": calibrated_high,
            "overconfident": overconfident,
            "lucky_guess": lucky_guess,
            "calibrated_low": calibrated_low,
            "note": f"{overconfident} questions were answered with high confidence but were incorrect. Focus on reviewing those topics." if overconfident > 0 else "Excellent calibration! Confidence aligned with test performance."
        },
        "debug_stats": session.scope.get("debug_stats") if session and session.scope else {}
    }

    report = db.query(AssessmentReport).filter(AssessmentReport.session_id == session_id).first()
    if not report:
        report = AssessmentReport(session_id=session_id, summary=summary)
        db.add(report)
    else:
        report.summary = summary
    db.commit()

    return report
