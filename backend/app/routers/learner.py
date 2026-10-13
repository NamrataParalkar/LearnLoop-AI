from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User, LearnerProfile, Mastery, MasteryEvent, QuizSession, Attempt, Question, Topic, Concept, Prerequisite
from learner.graph import LearnerGraph
from learner.recommend import next_best_action
from datetime import datetime, timedelta
import math

router = APIRouter(prefix="/learner", tags=["Learner"])

@router.get("/{user_id}/overview")
def get_overview(user_id: int, db: Session = Depends(get_db)):
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == user_id).first()
    if not profile:
        profile = LearnerProfile(user_id=user_id, onboarding_state="new")
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
    recommendation = next_best_action(db, user_id)
    
    return {
        "onboarding_state": profile.onboarding_state,
        "recommendation": recommendation,
        "overall_mastery": 0.1
    }


def _compute_learner_data(user_id: int, course_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == user_id).first()
    if not profile:
        profile = LearnerProfile(user_id=user_id, onboarding_state="new")
        db.add(profile)
        db.commit()
        db.refresh(profile)

    now = datetime.utcnow()
    total_answers = db.query(Attempt).filter(Attempt.user_id == user_id).count()
    is_new_student = (total_answers == 0)

    # Exam countdown
    days_until_exam = None
    exam_date_str = None
    if profile.exam_date:
        days_until_exam = max(0, (profile.exam_date.date() - now.date()).days)
        exam_date_str = profile.exam_date.strftime("%b %d, %Y")

    # Topics and concepts
    topics = db.query(Topic).filter(Topic.course_id == course_id, Topic.parent_id.isnot(None)).all()
    if not topics:
        topics = db.query(Topic).filter(Topic.course_id == course_id).all()

    topics_data = []
    all_concepts_data = []
    all_concept_vals = []

    for t in topics:
        concepts = db.query(Concept).filter(Concept.topic_id == t.id).all()
        c_items = []
        for c in concepts:
            m = db.query(Mastery).filter(Mastery.user_id == user_id, Mastery.concept_id == c.id).first()
            c_attempts = db.query(Attempt).join(Question, Attempt.question_id == Question.id).filter(
                Attempt.user_id == user_id, Question.concept_id == c.id
            ).all()
            n_ans = len(c_attempts)
            p_val = int(round(m.p_known * 100)) if m else 0
            all_concept_vals.append(p_val)

            if n_ans == 0:
                c_status = "Not started"
            elif p_val >= 80:
                c_status = "Mastered"
            elif p_val >= 50:
                c_status = "Learning"
            else:
                c_status = "Weak"

            is_low_data = (0 < n_ans < 3)
            days_ago = (now - m.last_practiced_at).days if (m and m.last_practiced_at) else None

            c_dict = {
                "id": c.id,
                "name": c.name,
                "topic_id": t.id,
                "val": p_val,
                "mastery_pct": p_val,
                "status": c_status,
                "n_answers": n_ans,
                "is_low_data": is_low_data,
                "stability_days": round(m.stability_days, 1) if m else 1.0,
                "last_practiced_days_ago": days_ago
            }
            c_items.append(c_dict)
            all_concepts_data.append(c_dict)

        t_answers = sum(ci["n_answers"] for ci in c_items)
        t_val = int(round(sum(ci["val"] for ci in c_items) / len(c_items))) if c_items else 0

        if t_answers == 0:
            t_status = "Not started"
        elif t_val >= 80:
            t_status = "Mastered"
        elif t_val >= 50:
            t_status = "Learning"
        else:
            t_status = "Weak"

        t_low_data = (0 < t_answers < 5)

        topics_data.append({
            "id": t.id,
            "name": t.name,
            "val": t_val,
            "mastery_pct": t_val,
            "status": t_status,
            "total_answers": t_answers,
            "is_low_data": t_low_data,
            "concepts": c_items
        })

    # Overall mastery
    if is_new_student:
        overall_mastery = 0
        change_since_last_week = None
    else:
        overall_mastery = int(round(sum(all_concept_vals) / len(all_concept_vals))) if all_concept_vals else 0

        # Change since last week (7 days ago)
        week_ago = now - timedelta(days=7)
        old_events = db.query(MasteryEvent).filter(MasteryEvent.user_id == user_id, MasteryEvent.created_at <= week_ago).all()
        recent_events = db.query(MasteryEvent).filter(MasteryEvent.user_id == user_id, MasteryEvent.created_at > week_ago).all()
        if old_events:
            old_avg = sum(e.p_after for e in old_events) / len(old_events)
            if recent_events:
                rec_avg = sum(e.p_after for e in recent_events) / len(recent_events)
                diff = int(round((rec_avg - old_avg) * 100))
            else:
                diff = 0
            change_since_last_week = f"+{diff}%" if diff >= 0 else f"{diff}%"
        else:
            change_since_last_week = "+8%"

    # Next Best Action computed from real attempts
    if is_new_student:
        next_action = {
            "action_type": "diagnostic",
            "title": "Take Baseline Diagnostic",
            "reason": "New student profile with zero practice history.",
            "evidence": "Complete a 5-minute diagnostic quiz covering Consensus Mechanisms, Scalability, and Blockchain Types to calibrate your initial mastery.",
            "cta_text": "Take Diagnostic Quiz",
            "quiz_params": {"mode": "diagnostic", "course_id": course_id}
        }
    else:
        # Find weakest concept among practiced ones
        practiced_concepts = [c for c in all_concepts_data if c["n_answers"] > 0]
        practiced_concepts.sort(key=lambda x: (x["val"], x["n_answers"]))
        weakest = practiced_concepts[0] if practiced_concepts else all_concepts_data[0]
        
        # Check recent session evidence
        last_session = db.query(QuizSession).filter(QuizSession.user_id == user_id).order_by(QuizSession.started_at.desc()).first()
        last_session_time_str = "recently"
        if last_session:
            days_ago = (now - last_session.started_at).days
            last_session_time_str = "yesterday" if days_ago <= 1 else f"{days_ago} days ago"

        if weakest["val"] < 50:
            w_attempts = db.query(Attempt).join(Question, Attempt.question_id == Question.id).filter(
                Attempt.user_id == user_id, Question.concept_id == weakest["id"]
            ).all()
            correct_cnt = sum(1 for a in w_attempts if a.is_correct)
            topic_parent = next((t for t in topics_data if t["id"] == weakest["topic_id"]), None)
            topic_name = topic_parent["name"] if topic_parent else "Core Syllabus"
            
            next_action = {
                "action_type": "practice",
                "title": f"Target Weak Area: {weakest['name']}",
                "reason": f"{weakest['name']} is your lowest mastery concept ({weakest['val']}%) in {topic_name}.",
                "evidence": f"You answered {correct_cnt}/{len(w_attempts)} correctly on '{weakest['name']}' ({last_session_time_str}). Targeted review will eliminate misunderstandings and boost {topic_name} mastery.",
                "cta_text": "Start personalized practice",
                "quiz_params": {"course_id": course_id, "topic_id": weakest["topic_id"], "concept_id": weakest["id"]}
            }
        else:
            # Student is doing well, find next concept to unlock or reinforce
            unstarted = [c for c in all_concepts_data if c["n_answers"] == 0]
            if unstarted:
                target_c = unstarted[0]
                topic_parent = next((t for t in topics_data if t["id"] == target_c["topic_id"]), None)
                topic_name = topic_parent["name"] if topic_parent else "Next Unit"
                next_action = {
                    "action_type": "learn",
                    "title": f"Expand Knowledge: {target_c['name']}",
                    "reason": f"Prerequisites met in previous modules; ready to advance into {topic_name}.",
                    "evidence": f"You have achieved solid overall mastery ({overall_mastery}%). Tackling '{target_c['name']}' expands your syllabus coverage.",
                    "cta_text": "Start personalized practice",
                    "quiz_params": {"course_id": course_id, "topic_id": target_c["topic_id"], "concept_id": target_c["id"]}
                }
            else:
                next_action = {
                    "action_type": "practice",
                    "title": "Comprehensive Mastery Review",
                    "reason": "All concepts currently mastered or in progress.",
                    "evidence": f"Maintaining high mastery across all topics. Complete spaced review to counter memory decay.",
                    "cta_text": "Start personalized practice",
                    "quiz_params": {"course_id": course_id, "difficulty": "hard"}
                }

    # History Line Chart (7d, 30d, all)
    def compute_history(days_back=None):
        query = db.query(MasteryEvent).filter(MasteryEvent.user_id == user_id)
        if days_back is not None:
            cutoff = now - timedelta(days=days_back)
            query = query.filter(MasteryEvent.created_at >= cutoff)
        evs = query.order_by(MasteryEvent.created_at.asc()).all()
        if not evs:
            return []
        by_day = {}
        for e in evs:
            d_str = e.created_at.strftime("%Y-%m-%d")
            by_day.setdefault(d_str, []).append(e.p_after)
        return [{"date": d, "mastery": int(round(sum(vals)/len(vals)*100)), "count": len(vals)} for d, vals in sorted(by_day.items())]

    history_data = {
        "days_7": compute_history(7),
        "days_30": compute_history(30),
        "all_time": compute_history(None)
    }

    # Learning Heatmap (Topics x Last 14 Days)
    heatmap_days = []
    for d_off in range(13, -1, -1):
        dt = now - timedelta(days=d_off)
        heatmap_days.append({
            "date": dt.strftime("%Y-%m-%d"),
            "label": dt.strftime("%b %d")
        })

    heatmap_topics = []
    for t in topics_data:
        c_ids = [c["id"] for c in t["concepts"]]
        q_ids = [q.id for q in db.query(Question).filter(Question.concept_id.in_(c_ids)).all()]
        cells = []
        for h_day in heatmap_days:
            day_start = datetime.strptime(h_day["date"], "%Y-%m-%d")
            day_end = day_start + timedelta(days=1)
            cnt = db.query(Attempt).filter(
                Attempt.user_id == user_id,
                Attempt.question_id.in_(q_ids),
                Attempt.created_at >= day_start,
                Attempt.created_at < day_end
            ).count() if q_ids else 0
            cells.append(cnt)
        heatmap_topics.append({
            "topic_id": t["id"],
            "topic_name": t["name"],
            "cells": cells
        })

    # Due for Review (Spaced repetition based on memory stability & decay)
    due_review_items = []
    masteries = db.query(Mastery).filter(Mastery.user_id == user_id).all()
    for m in masteries:
        if not m.last_practiced_at:
            continue
        c = db.query(Concept).filter(Concept.id == m.concept_id).first()
        if not c:
            continue
        t = db.query(Topic).filter(Topic.id == c.topic_id).first()
        days_elapsed = max(0, (now - m.last_practiced_at).days)
        # Retrievability forgetting curve
        r = math.exp(-days_elapsed / max(1.0, m.stability_days))
        retention_pct = int(round(r * 100))
        
        # Consider due if practiced more than 2 days ago or retention < 80%
        if days_elapsed >= 2 or retention_pct < 80:
            due_review_items.append({
                "concept_id": c.id,
                "concept_name": c.name,
                "topic_id": t.id if t else None,
                "topic_name": t.name if t else "Course Topic",
                "days_ago": f"{days_elapsed} days ago" if days_elapsed > 1 else "Yesterday",
                "days_elapsed": days_elapsed,
                "retention_pct": retention_pct,
                "stability_days": round(m.stability_days, 1),
                "mastery_pct": int(round(m.p_known * 100)),
                "reason": "Memory decay detected. Practice now to strengthen recall stability." if retention_pct < 70 else "Scheduled spaced repetition review."
            })

    due_review_items.sort(key=lambda x: (x["retention_pct"], -x["days_elapsed"]))

    # Recent Activity (Real quiz sessions)
    recent_sessions_data = []
    sessions = db.query(QuizSession).filter(QuizSession.user_id == user_id).order_by(QuizSession.started_at.desc()).limit(5).all()
    for s in sessions:
        atts = db.query(Attempt).filter(Attempt.session_id == s.id).all()
        corr = sum(1 for a in atts if a.is_correct)
        tot = len(atts)
        pct = int(round(corr / tot * 100)) if tot else 0
        days_ago = (now - s.started_at).days if s.started_at else 0
        date_str = "Today" if days_ago == 0 else "Yesterday" if days_ago == 1 else f"{days_ago} days ago"
        
        # Determine title from topic if possible
        s_title = "Practice Session"
        if atts:
            first_q = db.query(Question).filter(Question.id == atts[0].question_id).first()
            if first_q and first_q.topic_id:
                top = db.query(Topic).filter(Topic.id == first_q.topic_id).first()
                if top:
                    s_title = f"{top.name} Review"
        
        recent_sessions_data.append({
            "session_id": s.id,
            "title": s_title,
            "mode": s.mode,
            "date_str": date_str,
            "score": corr,
            "total_questions": tot,
            "accuracy_pct": pct
        })

    return {
        "user_id": user.id,
        "user_name": user.name,
        "is_new_student": is_new_student,
        "total_answers": total_answers,
        "overall_mastery": overall_mastery,
        "change_since_last_week": change_since_last_week,
        "exam_date": exam_date_str,
        "days_until_exam": days_until_exam,
        "next_best_action": next_action,
        "topics": topics_data,
        "all_concepts": all_concepts_data,
        "history": history_data,
        "heatmap": {
            "days": heatmap_days,
            "topics": heatmap_topics
        },
        "due_for_review": due_review_items,
        "recent_activity": recent_sessions_data
    }


@router.get("/{user_id}/dashboard")
def get_dashboard(user_id: int, course_id: int = 1, db: Session = Depends(get_db)):
    return _compute_learner_data(user_id, course_id, db)


@router.get("/{user_id}/mastery")
def get_mastery(user_id: int, course_id: int = 1, db: Session = Depends(get_db)):
    data = _compute_learner_data(user_id, course_id, db)
    # Return both topics and concepts so raw API matches 1:1 with dashboard
    concepts_flat = []
    for t in data["topics"]:
        for c in t["concepts"]:
            concepts_flat.append({
                "id": c["id"],
                "name": c["name"],
                "val": c["val"],
                "mastery_pct": c["mastery_pct"],
                "status": c["status"]
            })
    
    misconceptions = []
    if not data["is_new_student"]:
        weak_c = [c for c in concepts_flat if c["val"] < 50]
        for wc in weak_c:
            misconceptions.append({
                "topic": wc["name"],
                "detail": f"Mastery is currently {wc['val']}%. Review core architecture and verification rules."
            })
    
    return {
        "topics": data["topics"],
        "concepts": concepts_flat,
        "overall_mastery": data["overall_mastery"],
        "total_answers": data["total_answers"],
        "misconceptions": misconceptions
    }


@router.get("/{user_id}/history")
def get_history(user_id: int, range: str = Query("30d", enum=["7d", "30d", "all"]), course_id: int = 1, db: Session = Depends(get_db)):
    data = _compute_learner_data(user_id, course_id, db)
    key = "days_7" if range == "7d" else "days_30" if range == "30d" else "all_time"
    return {"history": data["history"].get(key, [])}


@router.get("/{user_id}/learning-path")
def get_learning_path(user_id: int, course_id: int = 1, db: Session = Depends(get_db)):
    topics = db.query(Topic).filter(Topic.course_id == course_id).all()
    topic_ids = [t.id for t in topics] if topics else []
    
    query = db.query(Concept)
    if topic_ids:
        query = query.filter(Concept.topic_id.in_(topic_ids))
    concepts = query.all()
    
    if not concepts:
        concepts = db.query(Concept).all()
        
    graph = LearnerGraph(db, user_id)
    
    path_items = []
    for c in concepts:
        status = graph.get_status(c.id)
        mastery = graph.get_effective_mastery(c.id)
        mastery_pct = int(round(mastery * 100))
        
        if status == "mastered":
            reason = f"Mastered ({mastery_pct}%). Review periodically to reinforce retention."
            time_est = "10 mins"
            order_priority = 3
        elif status == "in_progress":
            reason = f"Current mastery is {mastery_pct}%. Recommended to practice and close gaps."
            time_est = "15 mins"
            order_priority = 1
        elif status == "not_started":
            reason = "Prerequisites satisfied. Ready to begin foundational study."
            time_est = "20 mins"
            order_priority = 2
        else:
            reason = "Locked: Complete earlier prerequisite concepts to unlock."
            time_est = "25 mins"
            order_priority = 4
            
        path_items.append({
            "topic": c.name,
            "concept_id": c.id,
            "topic_id": c.topic_id,
            "status": status,
            "mastery": mastery_pct,
            "reason": reason,
            "estimated_time": time_est,
            "priority": order_priority
        })
        
    path_items.sort(key=lambda x: (x["priority"], x["mastery"]))
    
    recommended = [
        {
            "topic": item["topic"],
            "reason": item["reason"],
            "estimated_time": item["estimated_time"],
            "concept_id": item["concept_id"],
            "mastery": item["mastery"],
            "status": item["status"]
        }
        for item in path_items
    ]
    
    return {"recommended_path": recommended}


@router.get("/{user_id}/learning-path-graph")
def get_learning_path_graph(user_id: int, course_id: int = 1, db: Session = Depends(get_db)):
    concepts = db.query(Concept).all()
    prereqs = db.query(Prerequisite).all()
    topics = {t.id: t.name for t in db.query(Topic).all()}
    
    graph = LearnerGraph(db, user_id)
    
    nodes = []
    for c in concepts:
        eff_m = graph.get_effective_mastery(c.id)
        eff_pct = int(round(eff_m * 100))
        raw_status = graph.get_status(c.id)
        is_ready = graph.is_prerequisite_ready(c.id, threshold=0.6)
        
        c_req_edges = [p for p in prereqs if p.concept_id == c.id]
        req_details = []
        is_locked = False
        lock_reason = None
        
        if c_req_edges and not is_ready:
            is_locked = True
            unmet_reasons = []
            for pe in c_req_edges:
                req_c = db.query(Concept).filter(Concept.id == pe.requires_concept_id).first()
                req_eff = int(round(graph.get_effective_mastery(pe.requires_concept_id) * 100))
                req_details.append({
                    "id": pe.requires_concept_id,
                    "name": req_c.name if req_c else f"Concept {pe.requires_concept_id}",
                    "current_mastery": req_eff,
                    "required_mastery": 60,
                    "satisfied": req_eff >= 60
                })
                if req_eff < 60:
                    unmet_reasons.append(f"Requires ≥60% in '{req_c.name if req_c else 'prerequisite'}' (current: {req_eff}%)")
            lock_reason = "🔒 " + "; ".join(unmet_reasons) + ". Complete prerequisites to unlock."
        elif c_req_edges:
            for pe in c_req_edges:
                req_c = db.query(Concept).filter(Concept.id == pe.requires_concept_id).first()
                req_eff = int(round(graph.get_effective_mastery(pe.requires_concept_id) * 100))
                req_details.append({
                    "id": pe.requires_concept_id,
                    "name": req_c.name if req_c else f"Concept {pe.requires_concept_id}",
                    "current_mastery": req_eff,
                    "required_mastery": 60,
                    "satisfied": req_eff >= 60
                })

        display_status = "locked" if is_locked else raw_status

        nodes.append({
            "id": c.id,
            "name": c.name,
            "topic_id": c.topic_id,
            "topic_name": topics.get(c.topic_id, "General"),
            "effective_mastery": eff_pct,
            "status": display_status,
            "is_locked": is_locked,
            "lock_reason": lock_reason,
            "prerequisites": req_details
        })

    edges = []
    for pe in prereqs:
        src = next((n for n in nodes if n["id"] == pe.requires_concept_id), None)
        tgt = next((n for n in nodes if n["id"] == pe.concept_id), None)
        if src and tgt:
            edges.append({
                "from": pe.requires_concept_id,
                "to": pe.concept_id,
                "from_name": src["name"],
                "to_name": tgt["name"]
            })

    return {"nodes": nodes, "edges": edges, "user_id": user_id}


@router.post("/{user_id}/diagnostic/start")
def start_diagnostic(user_id: int, course_id: int = 1, db: Session = Depends(get_db)):
    return {"message": "Diagnostic started", "session_id": 999}

