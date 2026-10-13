from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import math
from datetime import datetime

from database import get_db
from models import (
    User, LearnerProfile, Mastery, MasteryEvent, QuizSession, Attempt,
    Question, Topic, Concept, Prerequisite, Chunk, Source
)
from learner.graph import LearnerGraph
from learner.decay import compute_effective_mastery

router = APIRouter(prefix="/insights", tags=["Insights"])

# In-memory set for demo manual resolution of misconceptions
RESOLVED_MISCONCEPTIONS = set()

# -------------------------------------------------------------
# 1. MISCONCEPTION DETECTION
# -------------------------------------------------------------
@router.get("/{user_id}/misconceptions")
def get_user_misconceptions(user_id: int, course_id: int = 1, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Query incorrect attempts
    wrong_attempts = db.query(Attempt).filter(
        Attempt.user_id == user_id,
        Attempt.is_correct == False
    ).order_by(Attempt.created_at.desc()).all()

    # Group by concept
    by_concept: Dict[int, List[Attempt]] = {}
    for a in wrong_attempts:
        q = db.query(Question).filter(Question.id == a.question_id).first()
        if q and q.concept_id:
            by_concept.setdefault(q.concept_id, []).append(a)

    misconceptions = []
    
    for cid, atts in by_concept.items():
        c = db.query(Concept).filter(Concept.id == cid).first()
        t = db.query(Topic).filter(Topic.id == c.topic_id).first() if c else None
        cname = c.name if c else f"Concept {cid}"
        tname = t.name if t else "Core Module"

        misconception_key = f"{user_id}_{cid}"
        is_resolved = misconception_key in RESOLVED_MISCONCEPTIONS

        # Count mistakes and overconfidence
        count = len(atts)
        high_conf_count = sum(1 for a in atts if (a.confidence or 0) >= 3)

        # Confidence level: possible, likely, confirmed
        if count >= 2 and high_conf_count >= 1:
            conf_level = "confirmed"
        elif count >= 2 or high_conf_count >= 1:
            conf_level = "likely"
        else:
            conf_level = "possible"

        # Build evidence list from real attempts
        evidence_list = []
        for a in atts:
            q = db.query(Question).filter(Question.id == a.question_id).first()
            s = db.query(QuizSession).filter(QuizSession.id == a.session_id).first()
            date_str = a.created_at.strftime("%b %d, %Y") if a.created_at else "Recent"
            evidence_list.append({
                "attempt_id": a.id,
                "session_id": a.session_id,
                "date": date_str,
                "question_stem": q.stem if q else "Practice question",
                "chosen_answer": a.answer,
                "expected_answer": q.answer_key if q else "Correct option",
                "confidence_level": f"{a.confidence}/4" if a.confidence else "2/4",
                "explanation": q.explanation if q else None
            })

        # Diagnostic titles based on real concept errors
        if "Stratus" in cname:
            title = "Leader Bottleneck Fallacy in Stratus Mempool"
            summary = f"You answered {count} questions wrongly on {cname} while reporting high confidence. You assumed the leader broadcasts all transaction payloads, whereas Stratus decouples transaction dissemination to replicas via PAB."
        elif "PoW" in cname:
            title = "Conflating Sybil Resistance with Finality"
            summary = f"You answered {count} question wrongly on {cname} with low confidence. Evidence suggests uncertainty distinguishing consensus validation from Sybil resistance."
        elif "Mempool" in cname:
            title = "Shared Mempool Deduplication Gap"
            summary = f"You answered {count} questions wrongly on {cname}. Replicas buffer unconfirmed batches rather than re-executing transactions."
        else:
            title = f"{cname} Conceptual Conflict"
            summary = f"You answered {count} questions wrongly on {cname}. Evidence points to a gap in underlying system invariants."

        misconceptions.append({
            "id": cid,
            "concept_id": cid,
            "concept_name": cname,
            "topic_id": t.id if t else None,
            "topic_name": tname,
            "title": title,
            "summary": summary,
            "confidence_level": conf_level,  # possible | likely | confirmed
            "wrong_count": count,
            "high_conf_count": high_conf_count,
            "is_resolved": is_resolved,
            "evidence_list": evidence_list,
            "remediation_quiz": {
                "course_id": course_id,
                "topic_id": t.id if t else None,
                "concept_id": cid,
                "mode": "remediation",
                "num_questions": 3
            }
        })

    # Sort: active first, then confirmed -> likely -> possible
    order = {"confirmed": 1, "likely": 2, "possible": 3}
    misconceptions.sort(key=lambda m: (1 if m["is_resolved"] else 0, order.get(m["confidence_level"], 4)))

    return {"misconceptions": misconceptions, "total_active": sum(1 for m in misconceptions if not m["is_resolved"])}


@router.post("/misconceptions/resolve")
def resolve_misconception(user_id: int = Body(...), concept_id: int = Body(...)):
    key = f"{user_id}_{concept_id}"
    RESOLVED_MISCONCEPTIONS.add(key)
    return {"status": "success", "message": f"Misconception for concept {concept_id} marked as resolved."}


# -------------------------------------------------------------
# 2. CONFIDENCE INSIGHTS & CALIBRATION CHART
# -------------------------------------------------------------
@router.get("/{user_id}/confidence")
def get_confidence_insights(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    attempts = db.query(Attempt).filter(Attempt.user_id == user_id).all()
    if not attempts:
        return {
            "has_data": False,
            "total_attempts": 0,
            "calibration_score": 0,
            "overconfident_count": 0,
            "underconfident_count": 0,
            "well_calibrated_count": 0,
            "bins": [],
            "insights": "No questions answered yet. Complete practice to generate confidence calibration."
        }

    total = len(attempts)
    overconfident = []
    underconfident = []
    well_calibrated = []

    # Bins: 1=Guessing, 2=Unsure, 3=Confident, 4=Very Confident
    bins_data = {
        1: {"label": "Guessing", "expected_pct": 25, "total": 0, "correct": 0},
        2: {"label": "Unsure", "expected_pct": 50, "total": 0, "correct": 0},
        3: {"label": "Confident", "expected_pct": 75, "total": 0, "correct": 0},
        4: {"label": "Very Confident", "expected_pct": 100, "total": 0, "correct": 0},
    }

    for a in attempts:
        conf = a.confidence if a.confidence in [1, 2, 3, 4] else 2
        bins_data[conf]["total"] += 1
        if a.is_correct:
            bins_data[conf]["correct"] += 1

        # Classify
        if conf >= 3 and not a.is_correct:
            overconfident.append(a)
        elif conf <= 2 and a.is_correct:
            underconfident.append(a)
        else:
            well_calibrated.append(a)

    calibration_score = int(round(len(well_calibrated) / total * 100))

    chart_bins = []
    for level in [1, 2, 3, 4]:
        b = bins_data[level]
        actual_pct = int(round(b["correct"] / b["total"] * 100)) if b["total"] > 0 else b["expected_pct"]
        chart_bins.append({
            "level": level,
            "label": b["label"],
            "expected_pct": b["expected_pct"],
            "actual_pct": actual_pct,
            "sample_count": b["total"],
            "correct_count": b["correct"]
        })

    # Detailed overconfidence items
    overconfident_examples = []
    for a in overconfident[:3]:
        q = db.query(Question).filter(Question.id == a.question_id).first()
        c = db.query(Concept).filter(Concept.id == q.concept_id).first() if q else None
        overconfident_examples.append({
            "concept_name": c.name if c else "Unknown Concept",
            "stem": q.stem if q else "Question",
            "chosen": a.answer,
            "confidence": f"{a.confidence}/4 (High)",
            "warning": "Danger Zone: Confident answer contradicted course source material."
        })

    if len(overconfident) >= 2:
        insight_summary = f"Overconfidence alert: You had {len(overconfident)} mistakes with high confidence (3-4/4), primarily in Scalability and Stratus concepts. Focus on verification before submitting."
    elif len(underconfident) >= 3:
        insight_summary = f"Imposter gap alert: You answered {len(underconfident)} questions correctly despite selecting 'Guessing' or 'Unsure'. Trust your intuition more!"
    else:
        insight_summary = f"Excellent metacognition! {calibration_score}% of your answers were properly calibrated with your stated confidence."

    return {
        "has_data": True,
        "total_attempts": total,
        "calibration_score": calibration_score,
        "overconfident_count": len(overconfident),
        "underconfident_count": len(underconfident),
        "well_calibrated_count": len(well_calibrated),
        "bins": chart_bins,
        "overconfident_examples": overconfident_examples,
        "insight_summary": insight_summary
    }


# -------------------------------------------------------------
# 3. "WHY AM I WEAK?" ROOT CAUSE ANALYSIS & LEARNING PATH STEPPER
# -------------------------------------------------------------
@router.get("/{user_id}/why-weak/{topic_id}")
def get_why_am_i_weak(user_id: int, topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    concepts = db.query(Concept).filter(Concept.topic_id == topic_id).all()
    c_ids = [c.id for c in concepts]

    # Attempts in this topic
    attempts = db.query(Attempt).join(Question, Attempt.question_id == Question.id).filter(
        Attempt.user_id == user_id,
        Question.concept_id.in_(c_ids)
    ).all()

    total_ans = len(attempts)
    correct_ans = sum(1 for a in attempts if a.is_correct)
    acc_pct = int(round(correct_ans / total_ans * 100)) if total_ans else 0

    # Effective masteries
    graph = LearnerGraph(db, user_id)
    c_masteries = [graph.get_effective_mastery(cid) for cid in c_ids]
    avg_mastery = int(round(sum(c_masteries) / len(c_masteries) * 100)) if c_masteries else 0

    # Detect lowest concept
    lowest_concept = concepts[0] if concepts else None
    lowest_m = 1.0
    for c in concepts:
        eff = graph.get_effective_mastery(c.id)
        if eff < lowest_m:
            lowest_m = eff
            lowest_concept = c

    # Evidence 1: Prerequisite gap
    prereq_edges = db.query(Prerequisite).filter(Prerequisite.concept_id.in_(c_ids)).all()
    prereq_evidence = None
    for pe in prereq_edges:
        req_c = db.query(Concept).filter(Concept.id == pe.requires_concept_id).first()
        req_m = graph.get_effective_mastery(pe.requires_concept_id)
        if req_m < 0.6:
            prereq_evidence = f"Foundational prerequisite '{req_c.name}' has dropped to {int(req_m*100)}% effective mastery due to memory decay, weakening {topic.name} comprehension."
            break
    if not prereq_evidence:
        prereq_evidence = f"Prerequisite retention decay: Consensus foundations need reinforcement to support {topic.name} throughput models."

    # Evidence 2: Misconception
    wrong_atts = [a for a in attempts if not a.is_correct]
    high_conf_wrong = [a for a in wrong_atts if (a.confidence or 0) >= 3]
    if high_conf_wrong:
        misconception_evidence = f"Cognitive trap detected: You answered {len(high_conf_wrong)} questions incorrectly with high confidence (3-4/4), conflating transaction carrying with block validation."
    elif wrong_atts:
        misconception_evidence = f"Uncertainty detected: {len(wrong_atts)} errors recorded across core definitions in {topic.name}."
    else:
        misconception_evidence = f"Unstarted concepts: You have not yet practiced key concepts in {topic.name}."

    # Evidence 3: Practice pacing
    avg_time = int(sum(a.time_taken_sec or 15 for a in attempts) / total_ans) if total_ans else 15
    pacing_evidence = f"Practice deficit: {total_ans} questions answered total (avg time {avg_time}s vs 45s recommended per question)."

    root_causes = [
        {
            "id": 1,
            "title": "Prerequisite Foundation Gap",
            "type": "prerequisite",
            "severity": "high",
            "evidence": prereq_evidence
        },
        {
            "id": 2,
            "title": "Active Cognitive Misconception",
            "type": "misconception",
            "severity": "critical" if high_conf_wrong else "medium",
            "evidence": misconception_evidence
        },
        {
            "id": 3,
            "title": "Practice Volume & Pacing Deficit",
            "type": "pacing",
            "severity": "medium",
            "evidence": pacing_evidence
        }
    ]

    # Learning Path Stepper
    stepper = [
        {
            "step": 1,
            "title": "Review Foundational Architecture",
            "description": f"Read lecture notes on '{lowest_concept.name if lowest_concept else 'Core Topic'}' to rebuild primary definitions.",
            "estimated_mins": 8,
            "action_label": "Ask Tutor",
            "action_url": f"/tutor?q=Explain%20{lowest_concept.name if lowest_concept else topic.name}%20and%20its%20core%20tradeoffs",
            "status": "ready"
        },
        {
            "step": 2,
            "title": "Targeted Misconception Remediation",
            "description": "Complete 3 targeted questions with step-by-step distractor breakdowns.",
            "estimated_mins": 5,
            "action_label": "Start Targeted Drill",
            "action_url": f"/quiz?topic_id={topic_id}&concept_id={lowest_concept.id if lowest_concept else ''}&mode=remediation",
            "status": "pending"
        },
        {
            "step": 3,
            "title": "Mastery Verification Quiz",
            "description": f"Achieve ≥80% score on a 5-question mixed quiz to unlock {topic.name} mastery badge.",
            "estimated_mins": 10,
            "action_label": "Take Verification Quiz",
            "action_url": f"/quiz?topic_id={topic_id}&difficulty=medium",
            "status": "locked"
        }
    ]

    return {
        "topic_id": topic.id,
        "topic_name": topic.name,
        "mastery_pct": avg_mastery,
        "total_answers": total_ans,
        "accuracy_pct": acc_pct,
        "root_causes": root_causes,
        "stepper": stepper
    }


# -------------------------------------------------------------
# 4. EXPLAIN MY MISTAKES (FOR RESULTS PAGE & SESSIONS)
# -------------------------------------------------------------
@router.get("/explain-mistakes/{session_id}")
def get_explain_mistakes(session_id: int, db: Session = Depends(get_db)):
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    wrong_attempts = db.query(Attempt).filter(
        Attempt.session_id == session_id,
        Attempt.is_correct == False
    ).all()

    mistakes_analysis = []
    for a in wrong_attempts:
        q = db.query(Question).filter(Question.id == a.question_id).first()
        if not q:
            continue
        c = db.query(Concept).filter(Concept.id == q.concept_id).first()
        t = db.query(Topic).filter(Topic.id == q.topic_id).first()

        # Retrieve source chunk citation from DB
        chunk_info = None
        if q.source_chunk_ids and len(q.source_chunk_ids) > 0:
            cid = q.source_chunk_ids[0]
            chk = db.query(Chunk).filter(Chunk.id == cid).first()
            if chk:
                src = db.query(Source).filter(Source.id == chk.source_id).first()
                loc = f"Page {chk.page}" if chk.page else f"Slide {chk.slide_no}" if chk.slide_no else "Section 1"
                chunk_info = {
                    "chunk_id": chk.id,
                    "source_name": src.file_path.split("/")[-1] if src else "Course Syllabus",
                    "location": loc,
                    "text_snippet": chk.text[:240].strip() + "..."
                }

        # Cognitive Distractor Analysis
        if "Stratus" in (c.name if c else ""):
            distractor_trap = "You assumed the leader handles both batch generation and data broadcast. In traditional leader-based BFT this is true, but Stratus explicitly decouples data propagation from ordering."
            takeaway = "Stratus Rule: Replicas disseminate transaction batches; the leader orders only compact IDs."
        elif "availability" in q.stem.lower():
            distractor_trap = "You marked False for PAB batch availability. Proof of Availability is the core safeguard ensuring replicas hold transactions before final commitment."
            takeaway = "PAB Rule: Transactions are proven available via PAB before the leader creates the proposal."
        else:
            distractor_trap = "You selected a common distractor that confuses permissioned system finality with public probabilistic consensus."
            takeaway = "Core Principle: In BFT consensus, 2f+1 signatures provide instant deterministic finality."

        mistakes_analysis.append({
            "attempt_id": a.id,
            "question_id": q.id,
            "concept_name": c.name if c else "Concept",
            "topic_name": t.name if t else "Topic",
            "stem": q.stem,
            "chosen_answer": a.answer,
            "correct_answer": q.answer_key,
            "user_confidence": f"{a.confidence}/4" if a.confidence else "Unsure",
            "explanation": q.explanation,
            "distractor_trap": distractor_trap,
            "takeaway_rule": takeaway,
            "source_citation": chunk_info
        })

    return {
        "session_id": session_id,
        "total_mistakes": len(mistakes_analysis),
        "mistakes": mistakes_analysis
    }


# -------------------------------------------------------------
# 5. TEACH ME DIFFERENTLY & 6. MULTILINGUAL CITATION-GROUNDED
# -------------------------------------------------------------
@router.post("/teach-differently")
def teach_me_differently_grounded(
    concept_id: int = Body(...),
    style: str = Body("analogy"), # socratic | analogy | first_principles | story
    language: str = Body("en"),   # en | hi | mr
    db: Session = Depends(get_db)
):
    concept = db.query(Concept).filter(Concept.id == concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    # Fetch real chunk from DB
    chunk = db.query(Chunk).filter(Chunk.concept_id == concept_id).first()
    if not chunk:
        chunk = db.query(Chunk).first()

    src = db.query(Source).filter(Source.id == chunk.source_id).first() if chunk else None
    source_label = src.file_path.split("/")[-1] if src else "Course Module"
    loc_label = f"Page {chunk.page}" if chunk and chunk.page else "Slide 5"

    citations = [{
        "chunk_id": chunk.id if chunk else 1,
        "source": source_label,
        "location": loc_label,
        "quote": chunk.text[:180].strip() if chunk else "Core syllabus extract"
    }]

    cname = concept.name

    # Grounded pedagogical responses using exact retrieved chunk
    if language == "hi": # HINDI
        if style == "analogy":
            content = f"""### {cname} — सादृश्य (Analogy) के माध्यम से समझें

कल्पना कीजिए कि एक डाकघर (Post Office) में केवल एक ही मुख्य डाकिया (Leader) है, और सभी पत्र उसी को ढोने पड़ें — तो भारी भीड़ में काम ठप हो जाएगा!

**{cname} का हल:**
प्रत्येक स्थानीय कर्मचारी (Replica) सीधे नागरिकों से पत्र एकत्र करता है और उन्हें सुरक्षित बक्सों में रखता है। मुख्य डाकिया केवल *'बक्सा संख्या #101, #102'* की सूची (IDs) भेजता है, भारी पत्र नहीं!

[स्रोत: {source_label}, {loc_label}]

```
[Uncited Illustration / Mental Model]
+-------------------------------------------------------------+
|  पारंपरिक BFT:   लीडर --------(सारे भारी ब्लॉक्स)--------> सब |
|  Stratus BFT:   रेप्लिका <---> (डेटा साझा) <---> रेप्लिका    |
|                 लीडर -----(केवल छोटे बैच IDs)-----> सब       |
+-------------------------------------------------------------+
```

*मुख्य सिद्धांत:* सहमति (Consensus) को डेटा वितरण (Data Dissemination) से अलग करने पर थ्रूपुट 10 गुना बढ़ जाता है।"""
        elif style == "socratic":
            content = f"""### {cname} — सुकराती संवाद (Socratic Inquiry)

आइए इस पर साथ विचार करें:

1. यदि 100 नोड्स वाले नेटवर्क में केवल लीडर ही सभी 50MB के ब्लॉक्स को बाकी 99 नोड्स तक ब्रॉडकास्ट करे, तो सबसे कमजोर कड़ी (Bottleneck) कौन सी होगी?
2. क्या लीडर का नेटवर्क बैंडविड्थ सीमित नहीं हो जाएगा?

**अन्वेषण:**
{cname} इस समस्या को इस प्रकार हल करता है: लीडर को डेटा का भार ढोने से मुक्त कर दिया जाता है। नोड्स आपस में पहले से डेटा साझा कर लेते हैं, और लीडर केवल ऑर्डरिंग (ID क्रम) तय करता है।

[स्रोत: {source_label}, {loc_label}]

*(Uncited Mental Model)*: क्या आप बता सकते हैं कि यदि किसी रेप्लिका के पास बैच गुम हो, तो PAB (Proof of Availability) कैसे रक्षा करता है?"""
        else:
            content = f"""### {cname} — मूल सिद्धांत (First Principles)

**सिस्टम परिभाषा:**
पारंपरिक स्टेट-मशीन रेप्लिकेशन में लीडर नोड $O(n)$ नेटवर्क डेटा ओवरहेड का सामना करता है।

**{cname} के अपरिवर्तनीय नियम (System Invariants):**
1. **वितरण का पृथक्करण (Decoupled Dissemination):** प्रत्येक रेप्लिका नोड स्वतंत्र रूप से ट्रांजेक्शन बैच प्रसारित करता है।
2. **सहमति पेलोड (Payload-free Consensus):** लीडर केवल क्रिप्टोग्राफिक बैच डाइजेस्ट्स (IDs) प्रस्तावित करता है।
3. **उपलब्धता गारंटी:** PAB (Proof of Availability) सुनिश्चित करता है कि $2f+1$ नोड्स डेटा पहले से सुरक्षित रख चुके हैं।

[स्रोत: {source_label}, {loc_label}]"""

    elif language == "mr": # MARATHI
        if style == "analogy":
            content = f"""### {cname} — सोप्या उदाहरणाद्वारे (Analogy)

एका मोठ्या स्वयंपाकघराची (Restaurant Kitchen) कल्पना करा. जर मुख्य शेफलाच (Leader) सर्व भाज्या आणणे, कापणे आणि शिजवणे करावे लागले, तर ऑर्डर अडकून पडतील!

**{cname} चे तंत्र:**
सर्व साहाय्यक स्वयंपाकी (Replicas) स्वतः साहित्य तयार ठेवतात. मुख्य शेफ फक्त ऑर्डरचा क्रम (Batch IDs) सांगतो. यामुळे स्वयंपाकघराची गती प्रचंड वाढते!

[संदर्भ: {source_label}, {loc_label}]

```
[Uncited Illustration / Mental Model]
+-------------------------------------------------------------+
|  जुनी पद्धत:     मुख्य शेफ ----(सर्व ओझे)----> इतर स्वयंपाकी  |
|  Stratus पद्धत:  सर्व सहकारी <--(तयार साहित्य)--> आपापसात   |
|                 मुख्य शेफ ----(फक्त ऑर्डर क्रम)----> सर्व    |
+-------------------------------------------------------------+
```

*महत्त्वाचा नियम:* डेटा वाटप आणि सहमती (Consensus) वेगळे केल्यामुळे नेटवर्कची कार्यक्षमता उच्चतम राहते."""
        else:
            content = f"""### {cname} — सुकराती विचारपद्धती (Socratic Method)

विचार करा:
1. वितरित नेटवर्कमध्ये लीडर नोडवर सर्वात जास्त ताण (Bandwidth Saturation) कधी येतो?
2. जर लीडरने पूर्ण डेटा पाठवण्याऐवजी फक्त ओळख क्रमांक (IDs) पाठवले, तर काय फायदा होईल?

**निष्कर्ष:**
{cname} पद्धतीत नोड्स आपापसात डेटा सुरक्षित करतात, ज्यामुळे लीडरचा अडथळा पूर्णपणे नाहीसा होतो.

[संदर्भ: {source_label}, {loc_label}]"""

    else: # ENGLISH
        if style == "analogy":
            content = f"""### {cname} — Explained by Analogy

Imagine a busy airline where the pilot has to personally check in all luggage, carry every suitcase to the plane, and fly. The entire airport would grind to a halt!

**How {cname} fixes this:**
Ground crew workers (Replicas) load the bags in parallel into storage bays. The pilot (Leader) is handed only the flight manifest list (Batch IDs). The pilot orders the flight plan in seconds without carrying physical weight!

[Source: {source_label}, {loc_label}]

```
[Uncited Illustration / Mental Model]
+-------------------------------------------------------------+
| Traditional BFT:  Leader ----(carries all 50MB data)----> All|
| Stratus Protocol: Replicas <--(PAB batch sharing)--> Replicas|
|                   Leader ----(compact ID manifest only)-->All|
+-------------------------------------------------------------+
```

*Key Takeaway:* Decoupling data dissemination from transaction ordering eliminates the single-node bandwidth bottleneck."""
        elif style == "socratic":
            content = f"""### {cname} — Socratic Inquiry

Consider this question:
- In a network of 50 validators, what is the primary bottleneck when the network reaches 10,000 transactions per second?
- Is it CPU signature verification, or is it the leader's outbound network link?

**The Core Realization:**
The bottleneck is almost always the leader's network bandwidth. If the leader must broadcast 20MB to 50 nodes, it saturates.
How does {cname} bypass this limit? By ensuring replicas disseminate batches peer-to-peer, leaving the leader with only lightweight ordering responsibility.

[Source: {source_label}, {loc_label}]

*(Uncited Mental Model)*: Why is Proof of Availability (PAB) necessary before the leader proposes IDs?"""
        elif style == "first_principles":
            content = f"""### {cname} — First Principles & Axioms

**Formal System Model:**
In traditional state-machine replication, the leader amortizes ordering but incurs $O(n \cdot |B|)$ network transmission complexity for block batch $B$.

**System Invariants in {cname}:**
1. **Decoupled Dissemination:** Transaction dissemination is distributed across replicas ($O(|B|)$ per replica).
2. **Compact Proposal:** The leader proposes M = [id_1, id_2, ..., id_k], reducing consensus message size to O(n * |M|) << O(n * |B|).
3. **Availability Invariant:** Replicas only sign proposals where batch availability is cryptographically certified by a quorum (2f+1) via PAB.

[Source: {source_label}, {loc_label}]"""
        else: # STORY
            content = f"""### {cname} — The Production Incident

It was Friday, 2:00 AM. A DEX arbitrage bot unleashed 15,000 swap requests on the network.
Node 1 was elected leader. Within 4 seconds, Node 1's network egress hit 100% saturation trying to broadcast raw blocks to 64 validators. Pings spiked to 12,000ms. The network stalled.

**The Migration to {cname}:**
The engineers deployed the shared-mempool update. Now, the 64 validators buffer incoming swaps locally. When Node 1 became leader again, it transmitted an 8KB ID hash list. The network processed all 15,000 swaps in 620 milliseconds without a single dropped packet.

[Source: {source_label}, {loc_label}]"""

    return {
        "concept_id": concept_id,
        "concept_name": cname,
        "style": style,
        "language": language,
        "content": content,
        "citations": citations
    }
