from database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'student';"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES users(id);"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'Computer Science';"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'Intermediate';"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
        conn.commit()
    print("MIGRATION_COMPLETE")

if __name__ == "__main__":
    run_migration()
