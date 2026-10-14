from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import json
import logging
import re

from database import get_db
import models
from retrieval.hybrid import hybrid_search
from retrieval.reranker import rerank_chunks
from retrieval.query_rewriter import rewrite_query
from tutor.refusal import check_refusal
from tutor.generation import generate_grounded_answer
from tutor.citations import CitationResolver
from llm import generate_text

logger = logging.getLogger(__name__)

router = APIRouter()

def is_source_summary_request(query: str) -> bool:
    q = query.lower()
    patterns = [
        r"explain (the )?(content|summary|slides?) in (the )?(attached|this) (ppt|pptx|presentation|pdf|file|document)",
        r"summarize (the )?(attached|this) (ppt|pptx|presentation|pdf|file|document)",
        r"what is (in|covered in) (the )?(attached|this) (ppt|pptx|presentation|pdf|file|document)",
        r"give me a summary of (the )?(attached|this) (ppt|pptx|presentation|pdf|file|document)"
    ]
    return any(re.search(p, q) for p in patterns)

@router.post("/chat")
def chat(
    course_id: int = Body(...),
    message: str = Body(...),
    session_id: Optional[int] = Body(None),
    topic_id: Optional[int] = Body(None),
    source_id: Optional[int] = Body(None),
    style: str = Body("standard"),
    stream: bool = Body(False),
    db: Session = Depends(get_db)
):
    # Ensure session exists
    if not session_id:
        session = models.ChatSession(course_id=course_id)
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
    else:
        session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
        if not session:
            session = models.ChatSession(id=session_id, course_id=course_id)
            db.add(session)
            db.commit()
            
    history = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at).all()
    history_list = [{"role": msg.role, "content": msg.content} for msg in history]
    
    # Persist the incoming user message to database
    user_msg = models.ChatMessage(
        session_id=session_id,
        role="user",
        content=message,
        grounded=True,
        status="answered",
        mode="source"
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    
    # Check for @filename, /filename or slash commands referencing specific files
    matched_source_id = source_id
    clean_message = message
    
    # 1. Look for @filename or @"filename" or @file:id
    file_tag_match = re.search(r'@(?:file[:=])?["\']?([^"\'\s,;?]+(?:\.[a-zA-Z0-9]+)?)["\']?', message)
    if file_tag_match:
        tag_text = file_tag_match.group(1).lower().strip()
        all_sources = db.query(models.Source).filter(models.Source.course_id == course_id).all()
        for s in all_sources:
            s_name = (s.file_path or "").split("/")[-1].split("\\")[-1].lower()
            if tag_text in s_name or s_name in tag_text or str(s.id) == tag_text:
                matched_source_id = s.id
                break
                
    source_id = matched_source_id
    
    # Check Special Case: Explain attached PPT / file or direct summary
    # Only route to full-source summary if it explicitly requests whole document/file summary or uses standalone /summary
    stripped = message.strip()
    is_summary = (
        is_source_summary_request(message)
        or stripped.lower() in ["/summary", "/summarize", "/explain ppt", "/explain slides", "/explain presentation", "/explain file"]
        or (stripped.lower().startswith("/summary") and not any(k in stripped.lower() for k in ["why", "how", "what is", "difference", "compare", "between"]))
    )
    
    # Clean command prefix (like /explain, /ask, /concept) so semantic search searches for the actual topic
    clean_query = re.sub(r'^/(?:explain|ask|concept|q|detail|review)\s+', '', message, flags=re.IGNORECASE).strip()
    if file_tag_match:
        clean_query = clean_query.replace(file_tag_match.group(0), '').strip()
    if not clean_query:
        clean_query = message
        
    # 1. Query Rewriting (skip if direct whole-source summary command)
    if is_summary:
        rewritten_query = clean_query
    else:
        rewritten_query = rewrite_query(clean_query, history_list)
        
    logger.info(f"[CHAT] Original: '{message}' | Clean Query: '{clean_query}' | Rewritten: '{rewritten_query}' | Bound source_id: {source_id} | Summary mode: {is_summary}")
    
    # 2. Retrieval
    if is_summary:
        # Find explicit source or PPTX/PDF source
        target_source = None
        if source_id:
            target_source = db.query(models.Source).filter(models.Source.id == source_id).first()
        if not target_source:
            target_source = db.query(models.Source).filter(
                models.Source.course_id == course_id,
                models.Source.source_type == "pptx"
            ).order_by(models.Source.id.desc()).first()
        if not target_source:
            target_source = db.query(models.Source).filter(models.Source.course_id == course_id).order_by(models.Source.id.desc()).first()
            
        if target_source:
            chunks = db.query(models.Chunk).filter(models.Chunk.source_id == target_source.id).order_by(models.Chunk.slide_no.asc(), models.Chunk.page.asc()).all()
        else:
            chunks = db.query(models.Chunk).join(models.Source).filter(models.Source.course_id == course_id).limit(15).all()
            
        top_chunks = chunks
        top_scores = [1.0] * len(chunks)
        max_score = 1.0
        status = "answered"
        suff_result = {"coverage": "full", "supporting_chunk_ids": [f"C{c.id}" for c in top_chunks], "missing": ""}
    else:
        candidate_chunks = hybrid_search(db, rewritten_query, course_id, topic_id=topic_id, source_id=source_id)
        top_chunks, top_scores, max_score = rerank_chunks(rewritten_query, candidate_chunks)
        
        # 3. Refusal Gate (if source explicitly tagged, grant high confidence)
        if source_id and top_chunks:
            status = "ok"
            suff_result = {"coverage": "full", "supporting_chunk_ids": [f"C{c.id}" for c in top_chunks], "missing": ""}
        else:
            status, suff_result = check_refusal(rewritten_query, top_chunks, max_score)


    logger.info(f"[RETRIEVAL] Found {len(top_chunks)} chunks, max_score={max_score:.4f}, status={status}")
    
    # Debug telemetry block
    debug_info = {
        "rewritten_query": rewritten_query,
        "max_score": float(max_score),
        "refusal_status": status,
        "sufficiency_check": suff_result,
        "retrieved_chunks": [
            {
                "id": c.id,
                "source_id": c.source_id,
                "type": c.chunk_type,
                "location": f"Slide {c.slide_no}" if c.slide_no else f"Page {c.page}" if c.page else f"{c.start_sec}s",
                "score": float(score),
                "preview": c.text[:120]
            }
            for c, score in zip(top_chunks, top_scores)
        ]
    }
    
    # Record user message in DB
    user_msg = models.ChatMessage(session_id=session_id, role="user", content=message)
    db.add(user_msg)
    db.commit()
    
    if status == "not_in_material":
        refusal_content = "This topic was not found in your uploaded course material. Would you like me to explain it using general knowledge?"
        msg = models.ChatMessage(
            session_id=session_id,
            role="assistant",
            content=refusal_content,
            status="not_in_material",
            grounded=True,
            retrieval_scores={"max_score": max_score, "debug": debug_info}
        )
        db.add(msg)
        db.commit()
        
        result_payload = {
            "session_id": session_id,
            "message_id": msg.id,
            "status": "not_in_material",
            "answer": refusal_content,
            "citations": [],
            "coverage_note": suff_result.get("missing", "Topic not found in current course materials."),
            "topics": [],
            "mode": "source",
            "debug": debug_info
        }
        
        if stream:
            def event_stream():
                chunk_data = json.dumps(result_payload)
                yield f"data: {chunk_data}\n\n"
            return StreamingResponse(event_stream(), media_type="text/event-stream")
        return result_payload

    # 4. Grounded Generation
    if is_summary:
        # Specialized summary generation grouped by slide
        summary_prompt = "You are LearnLoop AI. Summarize the following presentation slides clearly and concisely. For each slide, explain the main points and cite the slide chunk ID [C<id>].\n\nSlides:\n"
        for c in top_chunks:
            loc = f"Slide {c.slide_no}" if c.slide_no else f"Page {c.page}" if c.page else "Content"
            summary_prompt += f"[C{c.id}] ({loc}): {c.text}\n\n"
            
        with open("prompts/tutor_schema.json") as f:
            tutor_schema = json.load(f)
            
        from llm import generate_structured
        try:
            gen_result = generate_structured(summary_prompt, tutor_schema)
        except Exception as e:
            logger.error(f"Summary generation error: {e}")
            gen_result = {
                "answer_parts": [{"text": f"Here is the summary of the presentation across {len(top_chunks)} slides.", "chunk_ids": [f"C{c.id}" for c in top_chunks]}],
                "coverage_note": "Summary of all available slides."
            }
    else:
        gen_result = generate_grounded_answer(rewritten_query, top_chunks, style)
        
    # 5. Citation Resolution (database only)
    resolver = CitationResolver(top_chunks)
    full_text, citations, topic_ids = resolver.resolve(gen_result.get("answer_parts", []))
    coverage_note = gen_result.get("coverage_note", "")
    
    assistant_msg = models.ChatMessage(
        session_id=session_id,
        role="assistant",
        content=full_text,
        status=status,
        grounded=True,
        topic_ids=topic_ids,
        cited_chunk_ids=[c["chunk_id"] for c in citations],
        retrieval_scores={"max_score": max_score, "debug": debug_info}
    )
    db.add(assistant_msg)
    db.commit()
    
    result_payload = {
        "session_id": session_id,
        "message_id": assistant_msg.id,
        "status": status,
        "answer": full_text,
        "citations": citations,
        "coverage_note": coverage_note,
        "topics": topic_ids,
        "mode": "source",
        "debug": debug_info
    }
    
    if stream:
        def event_stream():
            chunk_data = json.dumps(result_payload)
            yield f"data: {chunk_data}\n\n"
        return StreamingResponse(event_stream(), media_type="text/event-stream")
        
    return result_payload

@router.post("/chat/external")
def chat_external(
    course_id: int = Body(...),
    message: str = Body(...),
    session_id: Optional[int] = Body(None),
    db: Session = Depends(get_db)
):
    if not session_id:
        session = models.ChatSession(course_id=course_id)
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
        
    prompt = f"Answer the following question from your general knowledge. Question: {message}"
    answer = generate_text(prompt)
    
    msg = models.ChatMessage(
        session_id=session_id,
        role="assistant",
        content=answer,
        status="answered",
        grounded=False,
        mode="external"
    )
    db.add(msg)
    db.commit()
    
    return {
        "session_id": session_id,
        "message_id": msg.id,
        "status": "answered",
        "answer": answer,
        "citations": [],
        "coverage_note": "Outside knowledge. Not from your course material.",
        "topics": [],
        "mode": "external"
    }

@router.get("/chat/sessions")
def list_sessions(course_id: int = 1, db: Session = Depends(get_db)):
    if not db:
        return {"sessions": [{"id": 1, "title": "Session 1: Distributed Consensus & Mempool"}]}
    try:
        sessions = db.query(models.ChatSession).filter(models.ChatSession.course_id == course_id).order_by(models.ChatSession.id.desc()).all()
        results = []
        for s in sessions:
            first_msg = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == s.id, models.ChatMessage.role == "user").order_by(models.ChatMessage.created_at.asc()).first()
            title = first_msg.content[:40] + "..." if first_msg and len(first_msg.content) > 40 else (first_msg.content if first_msg else f"Chat Session #{s.id}")
            results.append({
                "id": s.id,
                "title": title,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })
        return {"sessions": results}
    except Exception as e:
        logger.warning(f"Error querying sessions: {e}")
        return {"sessions": [{"id": 1, "title": "Session 1: Distributed Consensus & Mempool"}]}

@router.get("/chat/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at).all()
    results = []
    for m in messages:
        citations = []
        if m.cited_chunk_ids and isinstance(m.cited_chunk_ids, list):
            for cid in m.cited_chunk_ids:
                try:
                    chk = db.query(models.Chunk).filter(models.Chunk.id == cid).first()
                    if chk:
                        src = db.query(models.Source).filter(models.Source.id == chk.source_id).first()
                        src_title = os.path.basename(src.file_path) if src and src.file_path else "Course Material"
                        loc = f"Slide {chk.slide_no}" if chk.slide_no else (f"Page {chk.page}" if chk.page else "Section")
                        media = f"/api/media/{chk.source_id}?slide={chk.slide_no}" if chk.slide_no else (f"/api/media/{chk.source_id}?page={chk.page}" if chk.page else f"/api/media/{chk.source_id}")
                        citations.append({
                            "chunk_id": chk.id,
                            "source_id": chk.source_id,
                            "source_title": src_title,
                            "source_type": src.source_type if src else "pdf",
                            "location": loc,
                            "slide_no": chk.slide_no,
                            "page": chk.page,
                            "excerpt": chk.text[:180] + "..." if len(chk.text) > 180 else chk.text,
                            "media_url": media
                        })
                except Exception:
                    pass
        results.append({
            "id": m.id,
            "session_id": m.session_id,
            "role": m.role,
            "content": m.content,
            "status": m.status,
            "grounded": m.grounded,
            "mode": m.mode,
            "citations": citations,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })
    return {"messages": results}
