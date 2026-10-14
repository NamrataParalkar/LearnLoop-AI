import os
import sys

# Ensure backend root is in python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import SessionLocal, engine, Base
import models
from ingestion.parser_pdf import parse_pdf
from ingestion.parser_pptx import parse_pptx
from ingestion.chunker import chunk_units

def setup_curriculum():
    print("Connecting to database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Course 1: Scaling Blockchain Consensus
    course_1 = db.query(models.Course).filter(models.Course.id == 1).first()
    if not course_1:
        course_1 = models.Course(
            id=1,
            title="Scaling Blockchain Consensus via a Robust Shared Mempool",
            description="Comprehensive curriculum on Byzantine Fault Tolerance, leader bottlenecks, decoupled mempools, and the Stratus architecture by Namrata Paralkar."
        )
        db.add(course_1)
    else:
        course_1.title = "Scaling Blockchain Consensus via a Robust Shared Mempool"
        course_1.description = "Comprehensive curriculum on Byzantine Fault Tolerance, leader bottlenecks, decoupled mempools, and the Stratus architecture by Namrata Paralkar."
    db.commit()
    db.refresh(course_1)

    # Course 2 (for multi-course switching verification)
    course_2 = db.query(models.Course).filter(models.Course.id == 2).first()
    if not course_2:
        course_2 = models.Course(
            id=2,
            title="Advanced Data Structures and Graph Algorithms",
            description="Foundational study of balanced trees, graph traversals, and dynamic programming."
        )
        db.add(course_2)
        db.commit()

    print("Courses verified: Course 1 & Course 2.")

    # 2. Topics for Course 1
    # We create 3 primary parent topics and subtopics
    topics_spec = [
        ("Consensus Mechanisms", [
            ("Classical & Modern BFT", ["Leader-based BFT consensus", "PBFT", "HotStuff-style BFT"])
        ]),
        ("Blockchain Architecture & Types", [
            ("Sybil Resistance & Governance", ["PoW and PoS", "Permissioned blockchains", "Public chains"])
        ]),
        ("Scalability and Mempool Architecture", [
            ("Decoupled Mempool Scaling", ["Scalability trilemma", "Shared Mempool", "PAB transaction availability", "Stratus protocol"])
        ])
    ]

    concept_objs = {}
    for parent_name, subtopics in topics_spec:
        parent_t = db.query(models.Topic).filter(
            models.Topic.course_id == 1,
            models.Topic.name == parent_name,
            models.Topic.parent_id == None
        ).first()
        if not parent_t:
            parent_t = models.Topic(course_id=1, name=parent_name, parent_id=None)
            db.add(parent_t)
            db.commit()
            db.refresh(parent_t)

        for sub_name, concepts in subtopics:
            sub_t = db.query(models.Topic).filter(
                models.Topic.course_id == 1,
                models.Topic.name == sub_name,
                models.Topic.parent_id == parent_t.id
            ).first()
            if not sub_t:
                sub_t = models.Topic(course_id=1, name=sub_name, parent_id=parent_t.id)
                db.add(sub_t)
                db.commit()
                db.refresh(sub_t)

            for c_name in concepts:
                c = db.query(models.Concept).filter(
                    models.Concept.topic_id == sub_t.id,
                    models.Concept.name == c_name
                ).first()
                if not c:
                    c = models.Concept(topic_id=sub_t.id, name=c_name)
                    db.add(c)
                    db.commit()
                    db.refresh(c)
                concept_objs[c_name] = c

    print(f"Verified {len(concept_objs)} concepts for Course 1.")

    # 3. Prerequisites for Course 1
    # Define DAG prerequisite relationships: (concept, requires_concept)
    prereqs_spec = [
        ("PBFT", "Leader-based BFT consensus"),
        ("HotStuff-style BFT", "PBFT"),
        ("Permissioned blockchains", "PoW and PoS"),
        ("Public chains", "PoW and PoS"),
        ("Scalability trilemma", "PoW and PoS"),
        ("Shared Mempool", "Scalability trilemma"),
        ("Shared Mempool", "Permissioned blockchains"),
        ("PAB transaction availability", "Shared Mempool"),
        ("Stratus protocol", "PAB transaction availability"),
        ("Stratus protocol", "HotStuff-style BFT")
    ]

    for c_name, req_name in prereqs_spec:
        c = concept_objs.get(c_name)
        req_c = concept_objs.get(req_name)
        if c and req_c:
            existing = db.query(models.Prerequisite).filter(
                models.Prerequisite.concept_id == c.id,
                models.Prerequisite.requires_concept_id == req_c.id
            ).first()
            if not existing:
                p = models.Prerequisite(concept_id=c.id, requires_concept_id=req_c.id)
                db.add(p)
    db.commit()
    print("Prerequisites verified.")

    # 4. Sources and Chunks for Course 1
    # Check if real sources are registered
    sources_to_add = [
        ("data/uploads/1_1_202402100007_Namrata Paralkar_ASS2.pdf", "pdf"),
        ("data/uploads/1_1_202402100007_Namrata Paralkar_ASS2.pptx", "pptx"),
        ("data/uploads/sample.mp4", "video")
    ]

    for rel_path, stype in sources_to_add:
        abs_path = os.path.normpath(os.path.join(backend_dir, "..", rel_path))
        if os.path.exists(abs_path):
            src = db.query(models.Source).filter(
                models.Source.course_id == 1,
                models.Source.file_path == abs_path
            ).first()
            if not src:
                src = models.Source(
                    course_id=1,
                    file_path=abs_path,
                    source_type=stype,
                    status="completed",
                    progress=100
                )
                db.add(src)
                db.commit()
                db.refresh(src)
                print(f"Registered source {stype}: {os.path.basename(abs_path)}")

                # Parse and chunk PDF/PPTX to populate real Chunks
                try:
                    if stype == "pdf":
                        units = parse_pdf(src.id, abs_path)
                    elif stype == "pptx":
                        units = parse_pptx(src.id, abs_path)
                    else:
                        units = []

                    if units:
                        chunks = chunk_units(units)
                        for chk in chunks:
                            # Match chunk text to concepts
                            best_c = None
                            for c_name, c_obj in concept_objs.items():
                                if c_name.lower() in chk.text.lower():
                                    best_c = c_obj
                                    break
                            
                            c_model = models.Chunk(
                                source_id=src.id,
                                topic_id=best_c.topic_id if best_c else None,
                                concept_id=best_c.id if best_c else None,
                                chunk_type=chk.unit_type,
                                text=chk.text,
                                page=chk.page_no,
                                slide_no=chk.slide_no,
                                start_sec=chk.start_sec,
                                end_sec=chk.end_sec,
                                image_path=chk.image_path,
                                embedding=[0.0] * 1024
                            )
                            db.add(c_model)
                        db.commit()
                        print(f"Extracted {len(chunks)} chunks from {stype}.")
                except Exception as ex:
                    print(f"Error parsing source {rel_path}: {ex}")

    db.close()
    print("Curriculum setup complete!")

if __name__ == "__main__":
    setup_curriculum()
