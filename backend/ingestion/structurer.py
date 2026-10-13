import json
import logging
import networkx as nx
from typing import List, Dict
from llm import generate_structured
import models
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

def build_hierarchy(chunks: List[models.Chunk], db: Session, course_id: int):
    """
    Pass 1 & 2: Build Topic > Subtopic > Concept hierarchy and store in DB.
    Pass 4: Extract prerequisites and break cycles.
    """
    # Batch chunks text to avoid context limits
    chunk_summaries = []
    for c in chunks:
        if c.text and len(c.text) > 10:
            chunk_summaries.append(c.text[:200]) # just the start for summarization
            
    prompt = f"Analyze the following content summaries and build a Topic > Subtopic > Concept hierarchy. Also define prerequisites between concepts.\n\nContent:\n{' '.join(chunk_summaries[:50])}"
    
    with open("prompts/hierarchy_schema.json") as f:
        schema = json.load(f)
        
    for attempt in range(3):
        try:
            result = generate_structured(prompt, schema)
            break
        except Exception as e:
            logger.error(f"Hierarchy generation failed (attempt {attempt+1}): {e}")
            if attempt == 2:
                return
                
    topics_cache = {}
    concepts_cache = {}
    
    # Save to DB
    for topic_data in result.get("topics", []):
        topic_name = topic_data["name"]
        t = models.Topic(course_id=course_id, name=topic_name)
        db.add(t)
        db.commit()
        topics_cache[topic_name] = t
        
        for sub_data in topic_data.get("subtopics", []):
            sub_name = sub_data["name"]
            st = models.Topic(course_id=course_id, name=sub_name, parent_id=t.id)
            db.add(st)
            db.commit()
            topics_cache[sub_name] = st
            
            for concept_name in sub_data.get("concepts", []):
                concept_name = concept_name.strip()
                if concept_name.upper() == "BST":
                    concept_name = "Binary Search Tree"
                
                # Deduplicate ignoring case
                found = False
                for existing in concepts_cache.keys():
                    if existing.lower() == concept_name.lower():
                        concept_name = existing
                        found = True
                        break
                        
                if not found and concept_name not in concepts_cache:
                    c = models.Concept(topic_id=st.id, name=concept_name)
                    db.add(c)
                    db.commit()
                    concepts_cache[concept_name] = c

    # Extract prerequisites and break cycles using networkx
    G = nx.DiGraph()
    prereqs = result.get("prerequisites", [])
    for p in prereqs:
        concept = p["concept"]
        requires = p["requires"]
        if concept in concepts_cache and requires in concepts_cache:
            G.add_edge(requires, concept)
            
    # Break cycles
    try:
        cycles = list(nx.simple_cycles(G))
        for cycle in cycles:
            # Remove the last edge to break cycle
            G.remove_edge(cycle[-1], cycle[0])
    except nx.NetworkXNoCycle:
        pass
        
    for u, v in G.edges():
        c_req = concepts_cache[u]
        c = concepts_cache[v]
        p = models.Prerequisite(concept_id=c.id, requires_concept_id=c_req.id)
        db.merge(p)
    db.commit()

def tag_chunks(chunks: List[models.Chunk], db: Session, course_id: int):
    """
    Pass 3: Tag EVERY chunk with a topic_id and concept_id.
    """
    with open("prompts/concept_tagging_schema.json") as f:
        schema = json.load(f)
        
    topics = {t.name: t.id for t in db.query(models.Topic).filter(models.Topic.course_id == course_id).all()}
    concepts = {c.name: c.id for c in db.query(models.Concept).join(models.Topic).filter(models.Topic.course_id == course_id).all()}
    
    # Process in batches
    batch_size = 10
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        batch_text = "\n".join([f"ID: {c.id}\nText: {c.text}" for c in batch])
        
        prompt = f"Tag each of the following chunks with the most relevant topic and concept from this list:\nTopics: {list(topics.keys())}\nConcepts: {list(concepts.keys())}\n\nChunks:\n{batch_text}"
        
        for attempt in range(3):
            try:
                result = generate_structured(prompt, schema)
                for tag in result.get("tags", []):
                    chunk_id = tag["chunk_id"]
                    c_model = next((c for c in batch if c.id == chunk_id), None)
                    if c_model:
                        c_model.topic_id = topics.get(tag.get("topic"))
                        c_model.concept_id = concepts.get(tag.get("concept"))
                db.commit()
                break
            except Exception as e:
                logger.error(f"Tagging failed (attempt {attempt+1}): {e}")
