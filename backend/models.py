from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, JSON, Boolean, DateTime
from sqlalchemy.orm import relationship
from database import Base
from pgvector.sqlalchemy import Vector
import datetime
from app.config import settings

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    
    sources = relationship("Source", back_populates="course")
    topics = relationship("Topic", back_populates="course")

class Source(Base):
    __tablename__ = "sources"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    file_path = Column(String)
    source_type = Column(String) # "pdf", "pptx", "video"
    status = Column(String, default="pending") # pending, processing, completed, failed
    progress = Column(Integer, default=0) # 0 to 100
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    course = relationship("Course", back_populates="sources")
    chunks = relationship("Chunk", back_populates="source")

class Topic(Base):
    __tablename__ = "topics"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    parent_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    name = Column(String)
    
    course = relationship("Course", back_populates="topics")
    concepts = relationship("Concept", back_populates="topic")

class Concept(Base):
    __tablename__ = "concepts"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    name = Column(String)
    
    topic = relationship("Topic", back_populates="concepts")
    chunks = relationship("Chunk", back_populates="concept")

class Prerequisite(Base):
    __tablename__ = "prerequisites"
    concept_id = Column(Integer, ForeignKey("concepts.id"), primary_key=True)
    requires_concept_id = Column(Integer, ForeignKey("concepts.id"), primary_key=True)

class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=True)
    
    chunk_type = Column(String, default="text") # text, figure, transcript
    text = Column(Text)
    embedding = Column(Vector(settings.embed_dim))
    
    page = Column(Integer, nullable=True)
    page_end = Column(Integer, nullable=True)
    slide_no = Column(Integer, nullable=True)
    start_sec = Column(Float, nullable=True)
    end_sec = Column(Float, nullable=True)
    
    figure_caption = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    
    source = relationship("Source", back_populates="chunks")
    topic = relationship("Topic")
    concept = relationship("Concept", back_populates="chunks")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"))
    concept_id = Column(Integer, ForeignKey("concepts.id"))
    
    type = Column(String) # mcq, short, numerical
    difficulty = Column(String) # easy, medium, hard
    
    stem = Column(Text)
    options = Column(JSON, nullable=True) # mcq only
    answer_key = Column(Text)
    explanation = Column(Text)
    rubric = Column(JSON, nullable=True) # short answers
    numeric_tolerance = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    
    source_chunk_ids = Column(JSON)
    source_location = Column(JSON) # Snapshot of page/slide/timestamp
    embedding = Column(Vector(settings.embed_dim))
    verification = Column(JSON) # solver_answer, agreement, checks_passed, attempts
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    scope = Column(JSON) # {topic_ids: [], concept_ids: []}
    difficulty = Column(String)
    num_questions = Column(Integer)
    mode = Column(String) # practice | mock_exam | diagnostic | targeted
    time_limit_sec = Column(Integer, nullable=True)
    status = Column(String, default="active") # active, submitted
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)

class QuizItem(Base):
    __tablename__ = "quiz_items"
    session_id = Column(Integer, ForeignKey("quiz_sessions.id"), primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id"), primary_key=True)
    position = Column(Integer)

class Attempt(Base):
    __tablename__ = "attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    session_id = Column(Integer, ForeignKey("quiz_sessions.id"))
    
    answer = Column(Text)
    is_correct = Column(Boolean)
    score = Column(Float)
    time_taken_sec = Column(Integer, nullable=True)
    confidence = Column(Integer, nullable=True) # 1-4
    chosen_option = Column(String, nullable=True) # mcq
    feedback = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AssessmentReport(Base):
    __tablename__ = "assessment_reports"
    session_id = Column(Integer, ForeignKey("quiz_sessions.id"), primary_key=True)
    summary = Column(JSON) # per-topic scores, weak topics, misconceptions, recommendations

class LearnerProfile(Base):
    __tablename__ = "learner_profiles"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True, index=True)
    onboarding_state = Column(String, default="new") # new, diagnosing, active
    diagnostic_completed_at = Column(DateTime, nullable=True)
    exam_date = Column(DateTime, nullable=True)
    preferences = Column(JSON, nullable=True)

class Mastery(Base):
    __tablename__ = "mastery"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), index=True)
    p_known = Column(Float, default=0.1)
    p_init = Column(Float, default=0.1)
    n_observations = Column(Integer, default=0)
    n_correct = Column(Integer, default=0)
    last_practiced_at = Column(DateTime, nullable=True)
    stability_days = Column(Float, default=3.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class MasteryEvent(Base):
    __tablename__ = "mastery_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), index=True)
    source_type = Column(String) # quiz, chat, diagnostic, decay
    source_id = Column(Integer) # e.g. Attempt.id or ChatMessage.id
    p_before = Column(Float)
    p_after = Column(Float)
    correct = Column(Boolean, nullable=True)
    weight = Column(Float, default=1.0)
    confidence = Column(Integer, nullable=True)
    confidence_mismatch = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Optional for now
    course_id = Column(Integer, ForeignKey("courses.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    messages = relationship("ChatMessage", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String) # user, assistant
    content = Column(Text)
    grounded = Column(Boolean, default=True)
    status = Column(String) # answered, partial, not_in_material
    cited_chunk_ids = Column(JSON, nullable=True)
    topic_ids = Column(JSON, nullable=True)
    retrieval_scores = Column(JSON, nullable=True)
    mode = Column(String, default="source") # source, external
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("ChatSession", back_populates="messages")

