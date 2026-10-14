from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, JSON, Boolean, DateTime
from sqlalchemy.orm import relationship
from database import Base, engine
import datetime
from app.config import settings

# Graceful vector fallback if pgvector extension is not compiled into local Windows PostgreSQL
try:
    from pgvector.sqlalchemy import Vector
    # Check if vector extension actually exists on the DB
    with engine.connect() as _c:
        from sqlalchemy import text
        _res = _c.execute(text("SELECT 1 FROM pg_type WHERE typname = 'vector'")).fetchone()
        if _res:
            EmbeddingColumnType = Vector(settings.embed_dim)
        else:
            EmbeddingColumnType = JSON
except Exception:
    EmbeddingColumnType = JSON

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(String, default="student", index=True) # "student", "teacher", "admin"
    avatar = Column(String, nullable=True)

    courses_taught = relationship("Course", back_populates="teacher")

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    short_summary = Column(String(300), nullable=True)
    description = Column(Text)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    category = Column(String, default="Computer Science", index=True)
    level = Column(String, default="Intermediate", index=True) # Beginner, Intermediate, Advanced
    status = Column(String, default="published", index=True) # draft, published, archived
    is_published = Column(Boolean, default=True, index=True)
    prerequisites = Column(JSON, nullable=True) # list of prerequisite strings or concept names
    learning_objectives = Column(JSON, nullable=True) # list of objective strings
    thumbnail = Column(String, nullable=True)
    estimated_duration_hours = Column(Float, default=10.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    teacher = relationship("User", back_populates="courses_taught")
    sources = relationship("Source", back_populates="course", cascade="all, delete-orphan")
    topics = relationship("Topic", back_populates="course", cascade="all, delete-orphan")
    modules = relationship("CourseModule", back_populates="course", cascade="all, delete-orphan", order_by="CourseModule.display_order")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    reviews = relationship("CourseReview", back_populates="course", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="course", cascade="all, delete-orphan")

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
    embedding = Column(EmbeddingColumnType)
    
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
    embedding = Column(EmbeddingColumnType)
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


# ==============================================================================
# Production Course Management, Curriculum & Student Enrollment Models
# ==============================================================================

class CourseModule(Base):
    __tablename__ = "course_modules"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    course = relationship("Course", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module", cascade="all, delete-orphan", order_by="Lesson.display_order")


class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("course_modules.id", ondelete="CASCADE"), index=True, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    content_text = Column(Text, nullable=True) # Markdown / text explanation
    video_url = Column(String(500), nullable=True) # YouTube/MP4 URL
    resource_url = Column(String(500), nullable=True) # PDF/Document attachment path/url
    duration_minutes = Column(Integer, default=15)
    display_order = Column(Integer, default=0, index=True)
    is_preview = Column(Boolean, default=False) # Free preview lesson
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    module = relationship("CourseModule", back_populates="lessons")
    progress_records = relationship("LessonProgress", back_populates="lesson", cascade="all, delete-orphan")


class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    status = Column(String(50), default="active", index=True) # active, completed, dropped
    enrolled_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    last_accessed_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User")
    course = relationship("Course", back_populates="enrollments")
    last_lesson = relationship("Lesson")
    progress_records = relationship("LessonProgress", back_populates="enrollment", cascade="all, delete-orphan")
    certificate = relationship("Certificate", back_populates="enrollment", uselist=False, cascade="all, delete-orphan")


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id", ondelete="CASCADE"), index=True, nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    is_completed = Column(Boolean, default=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    enrollment = relationship("Enrollment", back_populates="progress_records")
    lesson = relationship("Lesson", back_populates="progress_records")


class CourseReview(Base):
    __tablename__ = "course_reviews"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    rating = Column(Integer, nullable=False) # 1 to 5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    course = relationship("Course", back_populates="reviews")
    user = relationship("User")


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(Integer, primary_key=True, index=True)
    certificate_code = Column(String(100), unique=True, index=True, nullable=False)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id", ondelete="CASCADE"), index=True, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    student_name = Column(String(200), nullable=False)
    course_title = Column(String(200), nullable=False)
    teacher_name = Column(String(200), nullable=True)
    issued_at = Column(DateTime, default=datetime.datetime.utcnow)

    enrollment = relationship("Enrollment", back_populates="certificate")
    course = relationship("Course", back_populates="certificates")
    user = relationship("User")


