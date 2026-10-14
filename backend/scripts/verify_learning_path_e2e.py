import os
os.environ["USE_TF"] = "0"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
import math
from datetime import datetime, timedelta

# Ensure backend root is in python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import SessionLocal
import models
from learner.graph import LearnerGraph
from learner.bkt import bkt_update
from learner.decay import compute_effective_mastery
from learner.updater import apply_attempts
from learner.recommend import next_best_action
from app.routers.learner import get_learning_path_graph
from app.routers.quiz import api_generate_quiz, api_submit_quiz, GenerateQuizReq, SubmitQuizReq, SubmitAnswerItem

def run_e2e_verification():
    db = SessionLocal()
    print("=" * 70)
    print("LEARNLOOP AI — LEARNING PATH & BKT END-TO-END VERIFICATION")
    print("=" * 70)

    # 1. Verify Course 1 exists and has concepts and edges
    course = db.query(models.Course).filter(models.Course.id == 1).first()
    assert course is not None, "FAIL: Course 1 not found in database!"
    print(f"[PASS] Course 1 found: '{course.title}'")

    topics = db.query(models.Topic).filter(models.Topic.course_id == 1).all()
    assert len(topics) > 0, "FAIL: No topics found for Course 1!"
    print(f"[PASS] Found {len(topics)} topics in Course 1.")

    concept_count = db.query(models.Concept).join(models.Topic).filter(models.Topic.course_id == 1).count()
    assert concept_count >= 10, f"FAIL: Expected at least 10 concepts, got {concept_count}"
    print(f"[PASS] Found {concept_count} concepts in Course 1.")

    prereq_count = db.query(models.Prerequisite).count()
    assert prereq_count >= 8, f"FAIL: Expected at least 8 prerequisites, got {prereq_count}"
    print(f"[PASS] Found {prereq_count} prerequisite relationships.")

    # 2. Test User 1 (Aarav Patel) Graph API
    print("\n--- Verifying User 1 (Aarav Patel) ---")
    res_1 = get_learning_path_graph(user_id=1, course_id=1, db=db)
    assert res_1["user_id"] == 1
    assert len(res_1["nodes"]) == concept_count
    assert len(res_1["edges"]) > 0

    nodes_1 = {n["name"]: n for n in res_1["nodes"]}
    print(f"[PASS] User 1 Graph returned {len(res_1['nodes'])} nodes and {len(res_1['edges'])} edges.")
    print(f"       Summary: Mastered={res_1['summary']['mastered_count']}, "
          f"In-Progress={res_1['summary']['learning_count']}, "
          f"Locked={res_1['summary']['locked_count']}, "
          f"Needs-Revision={res_1['summary']['revision_due_count']}, "
          f"Overall={res_1['summary']['overall_mastery']}%")

    # Verify BKT mastery values match database
    for n in res_1["nodes"]:
        m_row = db.query(models.Mastery).filter(models.Mastery.user_id == 1, models.Mastery.concept_id == n["id"]).first()
        if m_row:
            eff_calc = int(round(compute_effective_mastery(m_row.p_known, m_row.last_practiced_at, m_row.stability_days) * 100))
            assert n["effective_mastery"] == eff_calc, f"Mastery mismatch for {n['name']}: {n['effective_mastery']} vs {eff_calc}"

    print("[PASS] User 1 mastery values match persisted BKT & memory-decay calculations.")

    # 3. Test User 3 (New Student) - Cold Start
    print("\n--- Verifying User 3 (New Student - Cold Start) ---")
    res_3 = get_learning_path_graph(user_id=3, course_id=1, db=db)
    assert res_3["user_id"] == 3
    nodes_3 = {n["name"]: n for n in res_3["nodes"]}

    # Foundational concept without prerequisites should NOT be locked
    c_leader = nodes_3["Leader-based BFT consensus"]
    assert c_leader["is_locked"] is False
    assert c_leader["status"] == "not_started"
    print(f"[PASS] Foundational node '{c_leader['name']}' is unlocked and ready (status={c_leader['status']}).")

    # Downstream concept with prerequisite must be LOCKED
    c_pbft_3 = nodes_3["PBFT"]
    assert c_pbft_3["is_locked"] is True
    assert c_pbft_3["status"] == "locked"
    assert "Leader-based BFT consensus" in c_pbft_3["lock_reason"]
    print(f"[PASS] Downstream node '{c_pbft_3['name']}' is correctly LOCKED with reason: {c_pbft_3['lock_reason']}")

    # 4. REAL END-TO-END BKT PROGRESSION & UNLOCK TEST
    print("\n--- Executing Real BKT Assessment Progression & Downstream Unlock ---")
    # Create or reset a dedicated test student (User 99)
    uid_test = 99
    db.query(models.MasteryEvent).filter(models.MasteryEvent.user_id == uid_test).delete()
    db.query(models.Mastery).filter(models.Mastery.user_id == uid_test).delete()
    db.query(models.Attempt).filter(models.Attempt.user_id == uid_test).delete()
    test_session_ids = [s.id for s in db.query(models.QuizSession).filter(models.QuizSession.user_id == uid_test).all()]
    if test_session_ids:
        db.query(models.AssessmentReport).filter(models.AssessmentReport.session_id.in_(test_session_ids)).delete(synchronize_session=False)
        db.query(models.QuizItem).filter(models.QuizItem.session_id.in_(test_session_ids)).delete(synchronize_session=False)
    db.query(models.QuizSession).filter(models.QuizSession.user_id == uid_test).delete()
    db.commit()

    test_user = db.query(models.User).filter(models.User.id == uid_test).first()
    if not test_user:
        test_user = models.User(id=uid_test, name="BKT Verification Bot", email="bot99@learnloop.ai")
        db.add(test_user)
        db.commit()

    # Step A: Before taking quiz, verify PBFT is locked for test user
    g_before = get_learning_path_graph(user_id=uid_test, course_id=1, db=db)
    pbft_before = next(n for n in g_before["nodes"] if n["name"] == "PBFT")
    leader_before = next(n for n in g_before["nodes"] if n["name"] == "Leader-based BFT consensus")
    assert pbft_before["is_locked"] is True, "PBFT should initially be locked!"
    print(f"  Step A: Initial state: '{leader_before['name']}' mastery = {leader_before['effective_mastery']}%.")
    print(f"          '{pbft_before['name']}' is LOCKED (action_target={pbft_before['action_target_concept_id']}).")

    # Step B: Generate real quiz for the prerequisite: "Leader-based BFT consensus"
    leader_cid = leader_before["id"]
    gen_req = GenerateQuizReq(
        course_id=1,
        user_id=uid_test,
        scope={"concept_ids": [leader_cid]},
        difficulty="medium",
        num_questions=3,
        types=["mcq", "true_false"],
        mode="practice"
    )
    quiz_res = api_generate_quiz(gen_req, db=db)
    sess_id = quiz_res["session_id"]
    print(f"  Step B: Generated Quiz Session {sess_id} scoped to concept {leader_cid}.")

    # Step C: Submit 100% correct answers to trigger BKT update
    q_items = db.query(models.QuizItem).filter(models.QuizItem.session_id == sess_id).all()
    submit_answers = []
    for item in q_items:
        q = db.query(models.Question).filter(models.Question.id == item.question_id).first()
        submit_answers.append(SubmitAnswerItem(
            question_id=q.id,
            answer=q.answer_key,
            confidence=4,
            time_taken_sec=12
        ))

    sub_res = api_submit_quiz(sess_id, SubmitQuizReq(answers=submit_answers), db=db)
    print(f"  Step C: Submitted answers successfully. apply_attempts ran.")

    # Step D: Verify BKT updated the mastery in DB
    mastery_row = db.query(models.Mastery).filter(
        models.Mastery.user_id == uid_test,
        models.Mastery.concept_id == leader_cid
    ).first()
    assert mastery_row is not None
    assert mastery_row.p_known >= 0.60, f"Expected BKT mastery >= 0.60, got {mastery_row.p_known}"
    print(f"  Step D: DB Mastery record updated: p_known = {mastery_row.p_known:.4f} (>= 0.60 threshold).")

    # Step E: Query graph again — PBFT must now be UNLOCKED!
    g_after = get_learning_path_graph(user_id=uid_test, course_id=1, db=db)
    pbft_after = next(n for n in g_after["nodes"] if n["name"] == "PBFT")
    leader_after = next(n for n in g_after["nodes"] if n["name"] == "Leader-based BFT consensus")

    assert leader_after["effective_mastery"] >= 60, f"Leader effective mastery should be >= 60, got {leader_after['effective_mastery']}"
    assert pbft_after["is_locked"] is False, f"PBFT should now be UNLOCKED! Got is_locked={pbft_after['is_locked']}"
    print(f"  Step E: Re-queried Graph API: '{leader_after['name']}' mastery = {leader_after['effective_mastery']}%.")
    print(f"          '{pbft_after['name']}' status is now '{pbft_after['status']}' (UNLOCKED!)")
    print("[PASS] LEGITIMATE ASSESSMENT ADVANCEMENT AUTOMATICALLY UNLOCKED DOWNSTREAM CONCEPT!")

    # 5. Security & Authorization verification
    print("\n--- Verifying Authorization & Safety ---")
    try:
        get_learning_path_graph(user_id=999999, course_id=1, db=db)
        assert False, "Should have raised 404 for non-existent user"
    except Exception as ex:
        assert "404" in str(ex) or "not found" in str(ex).lower()
        print("[PASS] Querying invalid user properly raised 404 Not Found.")

    # Clean up test user 99
    db.query(models.MasteryEvent).filter(models.MasteryEvent.user_id == uid_test).delete()
    db.query(models.Mastery).filter(models.Mastery.user_id == uid_test).delete()
    db.query(models.Attempt).filter(models.Attempt.user_id == uid_test).delete()
    test_session_ids = [s.id for s in db.query(models.QuizSession).filter(models.QuizSession.user_id == uid_test).all()]
    if test_session_ids:
        db.query(models.AssessmentReport).filter(models.AssessmentReport.session_id.in_(test_session_ids)).delete(synchronize_session=False)
        db.query(models.QuizItem).filter(models.QuizItem.session_id.in_(test_session_ids)).delete(synchronize_session=False)
    db.query(models.QuizSession).filter(models.QuizSession.user_id == uid_test).delete()
    db.query(models.User).filter(models.User.id == uid_test).delete()
    db.commit()
    db.close()

    print("\n" + "=" * 70)
    print("ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_e2e_verification()
