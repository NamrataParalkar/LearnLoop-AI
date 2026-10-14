import os
import sys
from database import SessionLocal
import models

def tag_knowledge():
    db = SessionLocal()
    course_id = 1

    try:
        # 1. Structure Module 1: Data Structures & Algorithms
        ds_topic = db.query(models.Topic).filter(models.Topic.course_id == course_id, models.Topic.name.like("%Data Structures%")).first()
        if not ds_topic:
            ds_topic = models.Topic(course_id=course_id, name="Data Structures & Algorithms")
            db.add(ds_topic)
            db.commit()
        else:
            ds_topic.name = "Data Structures & Algorithms"
            db.commit()

        ds_sub = db.query(models.Topic).filter(models.Topic.parent_id == ds_topic.id, models.Topic.name == "Tree & Graph Structures").first()
        if not ds_sub:
            ds_sub = models.Topic(course_id=course_id, name="Tree & Graph Structures", parent_id=ds_topic.id)
            db.add(ds_sub)
            db.commit()

        # Re-parent existing concepts 1, 2, 3 under ds_sub
        concepts_map = {}
        for c_id in [1, 2, 3]:
            c = db.query(models.Concept).filter(models.Concept.id == c_id).first()
            if c:
                c.topic_id = ds_sub.id
                concepts_map[c.name] = c
        db.commit()

        # 2. Structure Module 2: Blockchain Consensus & Scalability
        bc_topic = db.query(models.Topic).filter(models.Topic.course_id == course_id, models.Topic.name == "Blockchain Consensus and Scalability").first()
        if not bc_topic:
            bc_topic = models.Topic(course_id=course_id, name="Blockchain Consensus and Scalability")
            db.add(bc_topic)
            db.commit()

        bc_subtopics_def = {
            "Leader-Based BFT Consensus": [
                "Byzantine Fault Tolerance (BFT)",
                "Permissioned Blockchains",
                "Leader Bottleneck"
            ],
            "Shared Mempool Architecture (Stratus)": [
                "Decoupled Transaction Dissemination",
                "Transaction ID Proposals",
                "Robust Shared Mempool",
                "Proof of Availability (PAB)"
            ],
            "System Evaluation and Trade-offs": [
                "Scalability Trilemma",
                "Modular Blockchain Stack"
            ]
        }

        for st_name, concept_list in bc_subtopics_def.items():
            st = db.query(models.Topic).filter(models.Topic.parent_id == bc_topic.id, models.Topic.name == st_name).first()
            if not st:
                st = models.Topic(course_id=course_id, name=st_name, parent_id=bc_topic.id)
                db.add(st)
                db.commit()
            for c_name in concept_list:
                c = db.query(models.Concept).filter(models.Concept.topic_id == st.id, models.Concept.name == c_name).first()
                if not c:
                    c = models.Concept(topic_id=st.id, name=c_name)
                    db.add(c)
                    db.commit()
                concepts_map[c_name] = c

        # 3. Structure Module 3: Predictive Modelling & Regression
        pm_topic = db.query(models.Topic).filter(models.Topic.course_id == course_id, models.Topic.name == "Predictive Modelling & Regression").first()
        if not pm_topic:
            pm_topic = models.Topic(course_id=course_id, name="Predictive Modelling & Regression")
            db.add(pm_topic)
            db.commit()

        pm_subtopics_def = {
            "Model Assessment & Generalization": [
                "Overfitting and Underfitting",
                "Train-Test Split & Validation",
                "Model Complexity Trade-offs"
            ],
            "Linear Regression Analysis": [
                "Linear Regression Formulation",
                "Feature Correlation & Selection",
                "Residual Analysis & Goodness of Fit"
            ]
        }

        for st_name, concept_list in pm_subtopics_def.items():
            st = db.query(models.Topic).filter(models.Topic.parent_id == pm_topic.id, models.Topic.name == st_name).first()
            if not st:
                st = models.Topic(course_id=course_id, name=st_name, parent_id=pm_topic.id)
                db.add(st)
                db.commit()
            for c_name in concept_list:
                c = db.query(models.Concept).filter(models.Concept.topic_id == st.id, models.Concept.name == c_name).first()
                if not c:
                    c = models.Concept(topic_id=st.id, name=c_name)
                    db.add(c)
                    db.commit()
                concepts_map[c_name] = c

        # Tag Chunks for Sources 34 & 35 (Blockchain / Stratus)
        blockchain_chunks = db.query(models.Chunk).filter(models.Chunk.source_id.in_([34, 35])).all()
        for ch in blockchain_chunks:
            txt = (ch.text or "").lower()
            if "bottleneck" in txt or "leader" in txt:
                target = concepts_map.get("Leader Bottleneck")
            elif "byzantine" in txt or "bft" in txt or "consensus" in txt:
                target = concepts_map.get("Byzantine Fault Tolerance (BFT)")
            elif "dissemination" in txt or "decoupled" in txt:
                target = concepts_map.get("Decoupled Transaction Dissemination")
            elif "proof of availability" in txt or "pab" in txt:
                target = concepts_map.get("Proof of Availability (PAB)")
            elif "proposal" in txt or "txid" in txt or "id" in txt:
                target = concepts_map.get("Transaction ID Proposals")
            elif "trilemma" in txt or "trade-off" in txt or "scalability" in txt:
                target = concepts_map.get("Scalability Trilemma")
            elif "modular" in txt or "stack" in txt:
                target = concepts_map.get("Modular Blockchain Stack")
            elif "permissioned" in txt:
                target = concepts_map.get("Permissioned Blockchains")
            else:
                target = concepts_map.get("Robust Shared Mempool")
            if target:
                ch.concept_id = target.id
                ch.topic_id = target.topic_id

        # Tag Chunks for Source 1 (Lec 6.pdf - Predictive Modelling)
        pm_chunks = db.query(models.Chunk).filter(models.Chunk.source_id == 1).all()
        for ch in pm_chunks:
            txt = (ch.text or "").lower()
            if "over-fitting" in txt or "under-fitting" in txt or "generalization" in txt:
                target = concepts_map.get("Overfitting and Underfitting")
            elif "train" in txt or "test" in txt or "sample" in txt or "split" in txt:
                target = concepts_map.get("Train-Test Split & Validation")
            elif "complexity" in txt or "trade-off" in txt or "bias" in txt or "variance" in txt:
                target = concepts_map.get("Model Complexity Trade-offs")
            elif "correlation" in txt or "scatter" in txt or "variable" in txt or "price" in txt:
                target = concepts_map.get("Feature Correlation & Selection")
            elif "residual" in txt or "error" in txt or "r-sq" in txt or "assessment" in txt or "r2" in txt:
                target = concepts_map.get("Residual Analysis & Goodness of Fit")
            else:
                target = concepts_map.get("Linear Regression Formulation")
            if target:
                ch.concept_id = target.id
                ch.topic_id = target.topic_id

        db.commit()

        # Update Prerequisites DAG
        prereq_pairs = [
            ("Binary Search Trees", "Graph Traversal"),
            ("Graph Traversal", "Dynamic Programming"),
            ("Model Complexity Trade-offs", "Overfitting and Underfitting"),
            ("Train-Test Split & Validation", "Overfitting and Underfitting"),
            ("Feature Correlation & Selection", "Linear Regression Formulation"),
            ("Linear Regression Formulation", "Residual Analysis & Goodness of Fit"),
            ("Byzantine Fault Tolerance (BFT)", "Leader Bottleneck"),
            ("Permissioned Blockchains", "Leader Bottleneck"),
            ("Leader Bottleneck", "Decoupled Transaction Dissemination"),
            ("Decoupled Transaction Dissemination", "Robust Shared Mempool"),
            ("Robust Shared Mempool", "Transaction ID Proposals"),
            ("Robust Shared Mempool", "Proof of Availability (PAB)"),
            ("Decoupled Transaction Dissemination", "Modular Blockchain Stack"),
            ("Modular Blockchain Stack", "Scalability Trilemma")
        ]

        db.query(models.Prerequisite).delete()
        db.commit()

        for req_name, c_name in prereq_pairs:
            req_c = concepts_map.get(req_name)
            c = concepts_map.get(c_name)
            if req_c and c:
                p = models.Prerequisite(concept_id=c.id, requires_concept_id=req_c.id)
                db.merge(p)
        db.commit()

        tagged_count = db.query(models.Chunk).filter(models.Chunk.concept_id != None).count()
        total_count = db.query(models.Chunk).count()
        print(f"Knowledge Tagging Complete! {tagged_count}/{total_count} chunks tagged across all concepts.")

    except Exception as e:
        db.rollback()
        print(f"Error during tagging: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    tag_knowledge()
