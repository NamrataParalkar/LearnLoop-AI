from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

import logging

logger = logging.getLogger(__name__)

def get_db():
    db = None
    try:
        db = SessionLocal()
        yield db
    except Exception as e:
        logger.warning(f"Database session error (PostgreSQL may be offline or starting): {e}")
        yield None
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass
