from sqlalchemy import text
from database import engine

def init_db_indexes():
    with engine.connect() as conn:
        # Add tsvector column for full-text search
        conn.execute(text("""
            ALTER TABLE chunks ADD COLUMN IF NOT EXISTS text_search tsvector 
            GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;
        """))
        
        # Add GIN index for text search
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS chunks_text_search_idx ON chunks USING GIN (text_search);
        """))
        
        # Add index for vector similarity (ivfflat)
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        """))
        
        conn.commit()

if __name__ == "__main__":
    init_db_indexes()
    print("Database indexes created successfully.")
