from database import engine, Base
from sqlalchemy import text
import models

def migrate_production_courses_schema():
    print("Beginning production schema migration...")
    with engine.connect() as conn:
        # 1. Update courses table with production attributes
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_summary VARCHAR(300);"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'published';"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS prerequisites JSON;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS learning_objectives JSON;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS estimated_duration_hours FLOAT DEFAULT 10.0;"))
        
        # 2. Add indexes for high-speed catalog query performance
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id);"))
        conn.commit()

    # 3. Create newly defined tables using SQLAlchemy metadata
    Base.metadata.create_all(bind=engine)

    # 4. Enforce unique constraints on enrollments, progress, reviews
    with engine.connect() as conn:
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_enrollment_user_course') THEN
                    ALTER TABLE enrollments ADD CONSTRAINT uq_enrollment_user_course UNIQUE (user_id, course_id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_progress_enrollment_lesson') THEN
                    ALTER TABLE lesson_progress ADD CONSTRAINT uq_progress_enrollment_lesson UNIQUE (enrollment_id, lesson_id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_review_course_user') THEN
                    ALTER TABLE course_reviews ADD CONSTRAINT uq_review_course_user UNIQUE (course_id, user_id);
                END IF;
            END $$;
        """))
        conn.commit()
    print("PRODUCTION_SCHEMA_MIGRATION_COMPLETE")

if __name__ == "__main__":
    migrate_production_courses_schema()
