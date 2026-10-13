from sqlalchemy.orm import Session
from models import Mastery, MasteryEvent, Attempt, Question
from learner.bkt import bkt_update, calculate_weight
from learner.decay import update_stability
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def apply_attempts(db: Session, session_id: int):
    """
    Idempotent updater processing quiz attempts into BKT mastery events.
    """
    attempts = db.query(Attempt).filter(Attempt.session_id == session_id).order_by(Attempt.created_at).all()
    
    for att in attempts:
        # Idempotency check: has this attempt already been applied?
        exists = db.query(MasteryEvent).filter(
            MasteryEvent.source_type == "quiz",
            MasteryEvent.source_id == att.id
        ).first()
        
        if exists:
            continue
            
        q = db.query(Question).filter(Question.id == att.question_id).first()
        if not q:
            continue
            
        mastery = db.query(Mastery).filter(
            Mastery.user_id == att.user_id,
            Mastery.concept_id == q.concept_id
        ).first()
        
        if not mastery:
            mastery = Mastery(user_id=att.user_id, concept_id=q.concept_id, p_known=0.1, p_init=0.1)
            db.add(mastery)
            db.commit() # Need an ID
            db.refresh(mastery)
            
        p_before = mastery.p_known
        
        # Difficulty weighting
        weight = calculate_weight(q.difficulty, att.is_correct)
        
        # Confidence logic
        confidence_mismatch = False
        if att.confidence is not None:
            if att.is_correct and att.confidence <= 2: # Guessing
                weight *= 0.5 
            elif not att.is_correct and att.confidence >= 3: # Confident but wrong
                weight *= 1.5
                confidence_mismatch = True
                
        # Guess rates
        p_guess = 0.25 if q.type == "mcq" else (0.10 if q.type == "short" else 0.05)
        
        # Apply BKT
        p_after = bkt_update(p_before, att.is_correct, p_guess=p_guess, weight=weight, score=att.score)
        
        # Update Stability if we have a gap
        if mastery.last_practiced_at:
            days_elapsed = (datetime.utcnow() - mastery.last_practiced_at).total_seconds() / 86400
            mastery.stability_days = update_stability(mastery.stability_days, att.is_correct, days_elapsed)
            
        # Update Row
        mastery.p_known = p_after
        mastery.n_observations += 1
        if att.is_correct:
            mastery.n_correct += 1
        mastery.last_practiced_at = datetime.utcnow()
        mastery.updated_at = datetime.utcnow()
        
        # Record Event
        event = MasteryEvent(
            user_id=att.user_id,
            concept_id=q.concept_id,
            source_type="quiz",
            source_id=att.id,
            p_before=p_before,
            p_after=p_after,
            correct=att.is_correct,
            weight=weight,
            confidence=att.confidence,
            confidence_mismatch=confidence_mismatch
        )
        db.add(event)
    
    db.commit()
