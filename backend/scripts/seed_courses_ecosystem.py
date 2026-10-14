import os
import sys
import datetime
from database import SessionLocal
from models import (
    User, Course, Topic, Concept, LearnerProfile, Mastery, MasteryEvent,
    Source, Chunk, Question, QuizSession, QuizItem, Attempt, AssessmentReport
)

db = SessionLocal()

print("--- SEEDING LEARNLOOP COURSES & TEACHER ECOSYSTEM ---")

# 1. Teachers and Students
teachers_data = [
    {
        "id": 101,
        "name": "Prof. David Malan",
        "email": "malan@learnloop.ai",
        "role": "teacher",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    },
    {
        "id": 102,
        "name": "Dr. Andrew Ng",
        "email": "andrew.ng@learnloop.ai",
        "role": "teacher",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
    },
    {
        "id": 103,
        "name": "Prof. Barbara Liskov",
        "email": "liskov@learnloop.ai",
        "role": "teacher",
        "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
    }
]

students_data = [
    {"id": 1, "name": "Aarav Patel", "email": "aarav@learnloop.ai", "role": "student"},
    {"id": 2, "name": "Meera Sharma", "email": "meera@learnloop.ai", "role": "student"},
    {"id": 3, "name": "New Student", "email": "student@learnloop.ai", "role": "student"}
]

for t in teachers_data:
    u = db.query(User).filter(User.id == t["id"]).first()
    if not u:
        u = User(id=t["id"], name=t["name"], email=t["email"], role=t["role"], avatar=t["avatar"])
        db.add(u)
    else:
        u.name = t["name"]
        u.email = t["email"]
        u.role = t["role"]
        u.avatar = t["avatar"]

for s in students_data:
    u = db.query(User).filter(User.id == s["id"]).first()
    if not u:
        u = User(id=s["id"], name=s["name"], email=s["email"], role=s["role"])
        db.add(u)
    else:
        u.name = s["name"]
        u.email = s["email"]
        u.role = s["role"]

db.commit()
print("Teachers and Students verified.")

# 2. Courses
courses_data = [
    {
        "id": 1,
        "title": "Data Structures & Algorithmic Paradigms",
        "description": "Master algorithmic complexity, balanced search trees, graph algorithms, and dynamic programming with hands-on AI tutoring.",
        "category": "Computer Science",
        "level": "Intermediate",
        "teacher_id": 101,
        "is_published": True
    },
    {
        "id": 2,
        "title": "Deep Learning & Neural Architectures",
        "description": "Comprehensive foundations of Transformers, attention mechanisms, backpropagation, and state-of-the-art vision & language models.",
        "category": "Artificial Intelligence",
        "level": "Advanced",
        "teacher_id": 102,
        "is_published": True
    },
    {
        "id": 3,
        "title": "Distributed Systems & Cloud Consensus",
        "description": "Practical guide to Byzantine fault tolerance, Paxos, Raft, consistency models, and resilient distributed microservice architectures.",
        "category": "System Design",
        "level": "Advanced",
        "teacher_id": 103,
        "is_published": True
    },
    {
        "id": 4,
        "title": "Full-Stack Web Development with React & Next.js",
        "description": "Modern frontend workflows, server components, reactive state patterns, and production REST & GraphQL APIs.",
        "category": "Web Development",
        "level": "Beginner",
        "teacher_id": 101,
        "is_published": True
    }
]

for cd in courses_data:
    c = db.query(Course).filter(Course.id == cd["id"]).first()
    if not c:
        c = Course(**cd)
        db.add(c)
    else:
        c.title = cd["title"]
        c.description = cd["description"]
        c.category = cd["category"]
        c.level = cd["level"]
        c.teacher_id = cd["teacher_id"]
        c.is_published = cd["is_published"]
db.commit()
print("Courses seeded.")

# 3. Hierarchy & Concepts for Course 1
t1 = db.query(Topic).filter(Topic.course_id == 1, Topic.name == "Algorithms").first()
if not t1:
    t1 = Topic(course_id=1, name="Algorithms")
    db.add(t1)
    db.commit()
    db.refresh(t1)

concepts_course_1 = [
    "Binary Search Trees",
    "Dynamic Programming",
    "Graph Traversal (BFS & DFS)",
    "Dijkstra's Shortest Path",
    "Merge Sort & Quick Sort"
]

for cname in concepts_course_1:
    cp = db.query(Concept).filter(Concept.topic_id == t1.id, Concept.name == cname).first()
    if not cp:
        cp = Concept(topic_id=t1.id, name=cname)
        db.add(cp)
db.commit()

# Ensure some knowledge chunks for Course 1
src1 = db.query(Source).filter(Source.course_id == 1).first()
if not src1:
    src1 = Source(course_id=1, file_path="data/uploads/1_algorithms_overview.pdf", source_type="pdf", status="completed", progress=100)
    db.add(src1)
    db.commit()
    db.refresh(src1)

# Ensure sample chunks for the first concept
cp1 = db.query(Concept).filter(Concept.topic_id == t1.id).first()
if cp1:
    ch = db.query(Chunk).filter(Chunk.concept_id == cp1.id).first()
    if not ch:
        ch = Chunk(
            source_id=src1.id,
            topic_id=t1.id,
            concept_id=cp1.id,
            chunk_type="text",
            text="Binary Search Trees provide average O(log n) time complexity for search, insertion, and deletion operations by maintaining the invariant that left children are strictly less and right children strictly greater than the root node.",
            page=1
        )
        db.add(ch)
        db.commit()

print("Seeded hierarchy and chunks successfully.")
db.close()
