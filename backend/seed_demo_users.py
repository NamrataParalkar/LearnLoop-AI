import os
import sys
from datetime import datetime, timedelta
from database import SessionLocal
from models import (
    User, LearnerProfile, Course, Topic, Concept, Question,
    QuizSession, QuizItem, Attempt, Mastery, MasteryEvent, AssessmentReport
)
from learner.updater import apply_attempts

db = SessionLocal()

print("--- SEEDING DEMO USERS ---")

# 1. Clean existing records for demo users 1, 2, 3
for uid in [1, 2, 3]:
    db.query(MasteryEvent).filter(MasteryEvent.user_id == uid).delete()
    db.query(Mastery).filter(Mastery.user_id == uid).delete()
    db.query(Attempt).filter(Attempt.user_id == uid).delete()
    
    # Delete assessment reports and quiz sessions & items
    sessions = db.query(QuizSession).filter(QuizSession.user_id == uid).all()
    for s in sessions:
        db.query(AssessmentReport).filter(AssessmentReport.session_id == s.id).delete()
        db.query(QuizItem).filter(QuizItem.session_id == s.id).delete()
        db.delete(s)
    db.commit()

    db.query(LearnerProfile).filter(LearnerProfile.user_id == uid).delete()
    db.commit()

# Upsert Users
users_data = [
    (1, "Aarav Patel", "aarav@learnloop.ai"),
    (2, "Meera Sharma", "meera@learnloop.ai"),
    (3, "New Student", "student@learnloop.ai")
]

for uid, name, email in users_data:
    u = db.query(User).filter(User.id == uid).first()
    if not u:
        u = User(id=uid, name=name, email=email)
        db.add(u)
    else:
        u.name = name
        u.email = email
db.commit()

now = datetime.utcnow()

# Learner Profiles
p1 = LearnerProfile(
    user_id=1,
    onboarding_state="active",
    exam_date=now + timedelta(days=14),
    diagnostic_completed_at=now - timedelta(days=21)
)
p2 = LearnerProfile(
    user_id=2,
    onboarding_state="active",
    exam_date=now + timedelta(days=28),
    diagnostic_completed_at=now - timedelta(days=14)
)
p3 = LearnerProfile(
    user_id=3,
    onboarding_state="new",
    exam_date=None,
    diagnostic_completed_at=None
)
db.add_all([p1, p2, p3])
db.commit()

print("Created 3 users and learner profiles.")

# 3. Ensure all concepts in Course 1 have questions
concepts = db.query(Concept).all()
concept_map = {c.name: c for c in concepts}

dummy_stems = {
    "Leader-based BFT consensus": [
        ("In leader-based BFT consensus protocols, the primary node proposes blocks while backup replicas vote in communication rounds.", "True", "true_false", "easy"),
        ("What is the primary vulnerability of naive leader-based BFT consensus architectures?", "B) Leader network bandwidth saturation and Denial of Service", "mcq", "medium", ["A) Inability to tolerate crash faults", "B) Leader network bandwidth saturation and Denial of Service", "C) Requiring 100% honest participants", "D) Unverifiable cryptographic signatures"])
    ],
    "PBFT": [
        ("Practical Byzantine Fault Tolerance (PBFT) tolerates up to f Byzantine faulty nodes in a system of at least 3f + 1 nodes.", "True", "true_false", "easy"),
        ("What is the message complexity of PBFT during the commit phase in a network of N replicas?", "C) O(N^2)", "mcq", "medium", ["A) O(1)", "B) O(N)", "C) O(N^2)", "D) O(N^3)"])
    ],
    "HotStuff-style BFT": [
        ("HotStuff achieves linear view change communication complexity through a three-phase commit rule.", "True", "true_false", "medium"),
        ("What is the primary architectural improvement of HotStuff over classical PBFT protocols?", "A) Linear communication complexity during leader rotation", "mcq", "hard", ["A) Linear communication complexity during leader rotation", "B) Elimination of cryptographic signatures", "C) Decentralized mempool dissemination", "D) Unbounded latency tolerance"])
    ],
    "Scalability trilemma": [
        ("According to the scalability trilemma, traditional public blockchains can easily maximize all three properties simultaneously.", "False", "true_false", "easy"),
        ("Which three trade-offs define the blockchain scalability trilemma?", "B) Decentralization, Security, and Scalability", "mcq", "medium", ["A) Latency, Throughput, and Finality", "B) Decentralization, Security, and Scalability", "C) Bandwidth, Storage, and Memory", "D) Privacy, Anonymity, and Verifiability"])
    ],
    "Permissioned blockchains": [
        ("In permissioned blockchains, validator node identities are known and authorized by network governance.", "True", "true_false", "easy"),
        ("Which consensus model is most suitable for high-throughput permissioned blockchain deployments?", "A) BFT-based quorum consensus (e.g. PBFT, Raft)", "mcq", "medium", ["A) BFT-based quorum consensus (e.g. PBFT, Raft)", "B) Proof-of-Work mining", "C) Delegated Proof-of-Stake with public slashing", "D) Nakamoto consensus with lottery"])
    ],
    "Public chains": [
        ("Public blockchains require permissionless identity participation and rely on economic incentives or stake to resist Sybil attacks.", "True", "true_false", "easy"),
        ("What primary factor bounds transaction throughput in monolithic public blockchains?", "C) Global state execution and block propagation across all nodes", "mcq", "hard", ["A) Lack of user transactions", "B) Restrictive smart contract compilers", "C) Global state execution and block propagation across all nodes", "D) Low storage prices"])
    ],
    "PoW and PoS": [
        ("Proof of Stake replaces computation-heavy energy mining with financial collateral staked by validators.", "True", "true_false", "easy"),
        ("What is the primary advantage of Proof-of-Stake over Proof-of-Work?", "A) Dramatically reduced electrical energy consumption and higher finality speed", "mcq", "medium", ["A) Dramatically reduced electrical energy consumption and higher finality speed", "B) Elimination of all Sybil attacks without incentives", "C) Infinite unbounded block sizes", "D) Guaranteed zero gas fees"])
    ],
    "Shared Mempool": [
        ("A shared mempool decouples transaction dissemination from consensus ordering, allowing replicas to broadcast transaction batches independently.", "True", "true_false", "medium"),
        ("How does a shared mempool architecture prevent the leader from becoming an ingress throughput bottleneck?", "A) Replicas stream transaction batches concurrently; the leader orders only compact batch IDs", "mcq", "hard", ["A) Replicas stream transaction batches concurrently; the leader orders only compact batch IDs", "B) The leader compresses all transactions into zero-knowledge proofs", "C) Transactions are dropped when the leader buffer fills", "D) Replicas bypass consensus and execute transactions optimistically"])
    ],
    "PAB transaction availability": [
        ("Provably Available Broadcast (PAB) guarantees that transaction payloads are stored across a quorum of replicas before the leader proposes ordering.", "True", "true_false", "medium"),
        ("What critical failure mode does Provably Available Broadcast (PAB) prevent in decoupled consensus systems?", "B) Data withholding attacks by malicious leaders", "mcq", "hard", ["A) Cryptographic key leakage", "B) Data withholding attacks by malicious leaders", "C) Network partition recovery failure", "D) Clock skew synchronization errors"])
    ],
    "Stratus protocol": [
        ("In the Stratus protocol, replicas achieve high throughput by streaming transaction batches in parallel with consensus ordering rounds.", "True", "true_false", "easy"),
        ("Which entity is solely responsible for ordering transaction batch IDs in Stratus?", "B) The designated leader orders compact IDs only", "mcq", "medium", ["A) All validator nodes via broadcast", "B) The designated leader orders compact IDs only", "C) Off-chain relayer nodes", "D) Smart contract execution engines"])
    ]
}

for cname, q_defs in dummy_stems.items():
    if cname in concept_map:
        c = concept_map[cname]
        existing_cnt = db.query(Question).filter(Question.concept_id == c.id).count()
        if existing_cnt == 0:
            for item in q_defs:
                stem = item[0]
                ans = item[1]
                qtype = item[2]
                diff = item[3]
                opts = item[4] if len(item) > 4 else None
                q = Question(
                    course_id=1,
                    topic_id=c.topic_id,
                    concept_id=c.id,
                    type=qtype,
                    difficulty=diff,
                    stem=stem,
                    options=opts,
                    answer_key=ans,
                    explanation=f"Directly derived from syllabus core material on {cname}.",
                    source_location={"location": f"Topic: {cname}"}
                )
                db.add(q)
db.commit()

# Re-fetch all questions grouped by concept
questions_by_concept = {}
for q in db.query(Question).all():
    if q.concept_id not in questions_by_concept:
        questions_by_concept[q.concept_id] = []
    questions_by_concept[q.concept_id].append(q)

# Helper to record a quiz session and replay attempts
def create_session_and_replay(user_id: int, q_list: list, correct_pattern: list, conf_pattern: list, days_ago: int, title: str):
    session_time = now - timedelta(days=days_ago)
    session = QuizSession(
        user_id=user_id,
        course_id=1,
        difficulty="mixed",
        num_questions=len(q_list),
        mode="practice",
        status="completed",
        started_at=session_time,
        submitted_at=session_time + timedelta(minutes=8)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    attempts = []
    for idx, q in enumerate(q_list):
        is_corr = correct_pattern[idx]
        conf = conf_pattern[idx]
        qi = QuizItem(session_id=session.id, question_id=q.id, position=idx)
        db.add(qi)

        ans = q.answer_key if is_corr else ("False" if q.type == "true_false" else "C")
        att = Attempt(
            user_id=user_id,
            question_id=q.id,
            session_id=session.id,
            answer=ans,
            is_correct=is_corr,
            score=1.0 if is_corr else 0.0,
            time_taken_sec=14,
            confidence=conf,
            created_at=session_time + timedelta(seconds=idx * 45)
        )
        db.add(att)
        attempts.append(att)

    db.commit()
    # Apply attempts through the learner pipeline
    apply_attempts(db, session.id)

    # Backdate the generated MasteryEvents and attempts
    db.query(Attempt).filter(Attempt.session_id == session.id).update({"created_at": session_time})
    for att in attempts:
        db.query(MasteryEvent).filter(
            MasteryEvent.source_type == "quiz",
            MasteryEvent.source_id == att.id
        ).update({"created_at": session_time})
    db.commit()
    print(f"Replayed session '{title}' for user {user_id} ({len(q_list)} questions, score={sum(1 for c in correct_pattern if c)}/{len(q_list)}) at {days_ago} days ago.")

# --- SEED AARAV (User 1): Strong overall (~82%), ONE weak topic (Stratus protocol / Scalability ~38%) ---
print("\nSeeding Aarav Patel (User 1)...")
c_pbft = concept_map.get("PBFT")
c_hotstuff = concept_map.get("HotStuff-style BFT")
c_leader = concept_map.get("Leader-based BFT consensus")
c_perm = concept_map.get("Permissioned blockchains")
c_pow = concept_map.get("PoW and PoS")
c_mempool = concept_map.get("Shared Mempool")
c_stratus = concept_map.get("Stratus protocol")
c_pab = concept_map.get("PAB transaction availability")
c_trilemma = concept_map.get("Scalability trilemma")

# Session 1: 12 days ago - Consensus fundamentals (all correct)
q_s1 = (questions_by_concept.get(c_pbft.id, [])[:2] + 
        questions_by_concept.get(c_hotstuff.id, [])[:2] + 
        questions_by_concept.get(c_leader.id, [])[:2])
create_session_and_replay(
    user_id=1,
    q_list=q_s1,
    correct_pattern=[True, True, True, True, True, True],
    conf_pattern=[4, 4, 3, 4, 4, 3],
    days_ago=12,
    title="Consensus Foundations"
)

# Session 2: 8 days ago - Blockchain Types & PoW/PoS (5/6 correct)
q_s2 = (questions_by_concept.get(c_perm.id, [])[:2] + 
        questions_by_concept.get(c_pow.id, [])[:2] + 
        questions_by_concept.get(c_pbft.id, [])[2:4])
create_session_and_replay(
    user_id=1,
    q_list=q_s2,
    correct_pattern=[True, True, True, False, True, True],
    conf_pattern=[4, 3, 4, 2, 4, 4],
    days_ago=8,
    title="Blockchain Types & Sybil Resistance"
)

# Session 3: 5 days ago - Shared Mempool (5/5 correct)
q_s3 = questions_by_concept.get(c_mempool.id, [])[:5]
create_session_and_replay(
    user_id=1,
    q_list=q_s3,
    correct_pattern=[True, True, True, True, True],
    conf_pattern=[4, 4, 4, 3, 4],
    days_ago=5,
    title="Decoupled Mempool Architecture"
)

# Session 4: 1 day ago - Stratus protocol & PAB (Weak Topic! 2/6 correct, high confidence mistakes)
q_s4 = (questions_by_concept.get(c_stratus.id, [])[:2] + 
        questions_by_concept.get(c_pab.id, [])[:2] + 
        questions_by_concept.get(c_trilemma.id, [])[:2])
create_session_and_replay(
    user_id=1,
    q_list=q_s4,
    correct_pattern=[False, False, False, True, False, True],
    conf_pattern=[4, 4, 3, 3, 4, 3],
    days_ago=1,
    title="Stratus Scalability & PAB Availability"
)


# --- SEED MEERA (User 2): Improving student (30% -> 65%), active trend ---
print("\nSeeding Meera Sharma (User 2)...")
# Session 1: 13 days ago - Weak start (2/6 correct)
q_m1 = (questions_by_concept.get(c_pbft.id, [])[:2] + 
        questions_by_concept.get(c_mempool.id, [])[:2] + 
        questions_by_concept.get(c_perm.id, [])[:2])
create_session_and_replay(
    user_id=2,
    q_list=q_m1,
    correct_pattern=[False, True, False, False, True, False],
    conf_pattern=[2, 2, 1, 2, 3, 1],
    days_ago=13,
    title="Initial Assessment"
)

# Session 2: 8 days ago - Progressing (3/6 correct)
q_m2 = (questions_by_concept.get(c_pbft.id, [])[:2] + 
        questions_by_concept.get(c_hotstuff.id, [])[:2] + 
        questions_by_concept.get(c_pow.id, [])[:2])
create_session_and_replay(
    user_id=2,
    q_list=q_m2,
    correct_pattern=[True, False, True, False, True, False],
    conf_pattern=[2, 3, 3, 2, 3, 2],
    days_ago=8,
    title="Consensus Review"
)

# Session 3: 4 days ago - Solidifying (4/6 correct)
q_m3 = (questions_by_concept.get(c_mempool.id, [])[2:4] + 
        questions_by_concept.get(c_leader.id, [])[:2] + 
        questions_by_concept.get(c_pow.id, [])[:2])
create_session_and_replay(
    user_id=2,
    q_list=q_m3,
    correct_pattern=[True, True, False, True, True, False],
    conf_pattern=[3, 3, 2, 4, 3, 2],
    days_ago=4,
    title="Mempool & Leader Dynamics"
)

# Session 4: Yesterday - Breakout improvement (5/6 correct)
q_m4 = (questions_by_concept.get(c_pbft.id, [])[:2] + 
        questions_by_concept.get(c_mempool.id, [])[:2] + 
        questions_by_concept.get(c_perm.id, [])[:2])
create_session_and_replay(
    user_id=2,
    q_list=q_m4,
    correct_pattern=[True, True, True, True, False, True],
    conf_pattern=[4, 3, 4, 4, 2, 4],
    days_ago=1,
    title="Recent Breakthrough Practice"
)

print("\n--- SEEDING COMPLETED SUCCESSFULLY ---")
for uid in [1, 2, 3]:
    m_cnt = db.query(Mastery).filter(Mastery.user_id == uid).count()
    att_cnt = db.query(Attempt).filter(Attempt.user_id == uid).count()
    ev_cnt = db.query(MasteryEvent).filter(MasteryEvent.user_id == uid).count()
    user = db.query(User).filter(User.id == uid).first()
    print(f"User {uid} ({user.name}): {m_cnt} masteries, {att_cnt} attempts, {ev_cnt} mastery events.")
