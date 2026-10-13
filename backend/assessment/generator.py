import json
import logging
import random
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from models import Question, QuizSession, QuizItem, Chunk, Concept, Topic, Source
from assessment.verifier import verify_question
from assessment.dedupe import is_duplicate
from llm import generate_structured
from app.config import settings

logger = logging.getLogger(__name__)

def generate_quiz(
    db: Session,
    course_id: int,
    scope: Dict,
    difficulty: str,
    num_questions: int,
    q_types: List[str],
    user_id: int,
    mode: str = "practice",
    time_limit_sec: Optional[int] = None
) -> QuizSession:
    """
    Dynamically generates grounded questions from the database chunks,
    runs cross-encoder / LLM verification, and links them to the QuizSession.
    """
    # Create session
    session = QuizSession(
        user_id=user_id,
        course_id=course_id,
        scope=scope or {},
        difficulty=difficulty,
        num_questions=num_questions,
        mode=mode,
        time_limit_sec=time_limit_sec,
        status="active"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # 1. Gather Chunks matching scope
    query = db.query(Chunk).filter(Chunk.text != None)
    
    # Filter by course if chunk has relation
    course_chunks = []
    all_chunks = query.all()
    for c in all_chunks:
        if c.source and c.source.course_id == course_id:
            course_chunks.append(c)
        elif not c.source:
            course_chunks.append(c)
            
    if not course_chunks:
        course_chunks = all_chunks

    # Scope filtering
    concept_ids = scope.get("concept_ids") if scope else []
    topic_ids = scope.get("topic_ids") if scope else []
    
    candidate_chunks = []
    if concept_ids:
        candidate_chunks = [c for c in course_chunks if c.concept_id in concept_ids]
    elif topic_ids:
        candidate_chunks = [c for c in course_chunks if c.topic_id in topic_ids]
        
    if not candidate_chunks:
        candidate_chunks = course_chunks
        
    if not candidate_chunks:
        raise ValueError("No course chunks available to generate questions from.")

    # 2. Preparation for generation
    types_pool = q_types if q_types and len(q_types) > 0 else ["mcq"]
    diff_pool = ["easy", "medium", "hard"] if difficulty == "mixed" else [difficulty]

    total_generated = 0
    accepted_count = 0
    rejected_count = 0
    verification_logs = []
    
    questions_created = []

    # Iterate to generate requested number of questions
    for i in range(num_questions):
        chunk = candidate_chunks[i % len(candidate_chunks)]
        q_type = types_pool[i % len(types_pool)]
        cur_diff = diff_pool[i % len(diff_pool)]
        
        # Concept & topic info
        concept = db.query(Concept).filter(Concept.id == chunk.concept_id).first() if chunk.concept_id else None
        topic = db.query(Topic).filter(Topic.id == chunk.topic_id).first() if chunk.topic_id else None
        concept_name = concept.name if concept else "Blockchain Consensus"
        topic_name = topic.name if topic else "Distributed Systems"

        # Generation Prompt
        prompt = f"""You are a professional university professor authoring examination questions.
Write a {cur_diff} {q_type} question strictly grounded in the following course material.

Rules:
1. Grounding: The question stem, correct answer, and distractors must be factually supported by the excerpt.
2. Directness: Do NOT reference slides, pages, or document meta-text (do not say "As stated in the text" or "According to slide 3"). Ask directly about the technical principles, mechanisms, and trade-offs.
3. Question Types:
   - mcq: Exactly 4 distinct options labeled A), B), C), D). Exactly 1 option must be definitively correct. Distractors must be plausible but false according to the material. answer_key must be the letter (e.g. "B") or full option.
   - true_false: options must be ["True", "False"]. answer_key must be "True" or "False".
   - multi_select: Exactly 4 options labeled A), B), C), D). Exactly 2 or 3 correct. answer_key is comma-separated (e.g. "A, C").
   - short: Clear technical question requiring 1-2 sentences. options = null. answer_key is concise factual answer. rubric is a list of 2-3 key points.
4. Explanation: Provide a comprehensive explanation citing the technical reason from the material.

Concept: {concept_name}
Topic: {topic_name}
Difficulty: {cur_diff}
Question Type: {q_type}

Course Material Excerpt:
{chunk.text[:2000]}

Return JSON:
{{
  "stem": "question text",
  "type": "{q_type}",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "answer_key": "...",
  "explanation": "...",
  "rubric": ["point 1", "point 2"]
}}
"""
        schema = {
            "type": "object",
            "properties": {
                "stem": {"type": "string"},
                "type": {"type": "string"},
                "options": {"type": "array", "items": {"type": "string"}},
                "answer_key": {"type": "string"},
                "explanation": {"type": "string"},
                "rubric": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["stem", "type", "answer_key", "explanation"]
        }

        candidate = None
        for attempt in range(2):
            try:
                candidate = generate_structured(prompt, schema, model_name=settings.tutor_model or "gemini-3.5-flash-lite")
                total_generated += 1
                break
            except Exception as e:
                logger.warning(f"Question generation attempt {attempt+1} failed: {e}")

        if not candidate:
            continue

        # Format options if missing labels
        if candidate.get("options") and q_type == "mcq" and len(candidate["options"]) == 4:
            clean_opts = []
            labels = ["A)", "B)", "C)", "D)"]
            for idx, opt in enumerate(candidate["options"]):
                opt_str = str(opt).strip()
                if not opt_str.startswith(("A)", "B)", "C)", "D)", "A.", "B.", "C.", "D.")):
                    clean_opts.append(f"{labels[idx]} {opt_str}")
                else:
                    clean_opts.append(opt_str)
            candidate["options"] = clean_opts

        # 3. Cross-Verifier Check
        v_res = verify_question(candidate, chunk.text)
        
        if v_res.get("checks_passed", True):
            accepted_count += 1
            verification_logs.append({
                "question": candidate["stem"],
                "status": "accepted",
                "solver_answer": v_res.get("solver_answer"),
                "agreement": v_res.get("agreement", True),
                "is_grounded": v_res.get("is_grounded", True)
            })
        else:
            rejected_count += 1
            verification_logs.append({
                "question": candidate["stem"],
                "status": "rejected",
                "reason": v_res.get("rejection_reason", "Verifier check failed"),
                "solver_answer": v_res.get("solver_answer"),
                "answer_key": candidate.get("answer_key")
            })
            v_res["attempts"] = 2

        # 4. Save Question in DB
        source_title = "Course Material"
        source_type = "pdf"
        if chunk.source and chunk.source.file_path:
            source_title = chunk.source.file_path.replace("\\", "/").split("/")[-1]
            source_type = chunk.source.source_type or "pdf"

        location_str = f"Page {chunk.page}" if chunk.page else (f"Slide {chunk.slide_no}" if chunk.slide_no else "Source Material")

        source_loc = {
            "page": chunk.page,
            "slide": chunk.slide_no,
            "timestamp": chunk.start_sec,
            "source_title": source_title,
            "source_type": source_type,
            "location": location_str,
            "excerpt": chunk.text[:300] if chunk.text else ""
        }

        q = Question(
            course_id=course_id,
            topic_id=chunk.topic_id or 1,
            concept_id=chunk.concept_id or 1,
            type=candidate["type"],
            difficulty=cur_diff,
            stem=candidate["stem"],
            options=candidate.get("options"),
            answer_key=str(candidate["answer_key"]).strip(),
            explanation=candidate["explanation"],
            rubric=candidate.get("rubric"),
            source_chunk_ids=[chunk.id],
            source_location=source_loc,
            embedding=[0.0] * 1024,
            verification=v_res
        )
        db.add(q)
        db.commit()
        db.refresh(q)

        # 5. Link to QuizItem
        qi = QuizItem(session_id=session.id, question_id=q.id, position=len(questions_created) + 1)
        db.add(qi)
        questions_created.append(q)

    # 6. Save verification debug stats
    debug_stats = {
        "total_generated": total_generated,
        "accepted_count": accepted_count,
        "rejected_count": rejected_count,
        "details": verification_logs
    }
    session.scope = {**(session.scope or {}), "debug_stats": debug_stats}
    db.commit()
    db.refresh(session)

    return session
