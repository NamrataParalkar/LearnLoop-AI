from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models
from app.routers import courses, ingestion, chat, quiz, learner, insights, notebook

import logging

logger = logging.getLogger(__name__)

# Create database tables if database is reachable
try:
    with engine.connect() as conn:
        from sqlalchemy import text
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables and pgvector extension verified successfully.")
except Exception as e:
    logger.warning(f"Could not connect to PostgreSQL on startup: {e}. Running in standalone mock/cache mode.")

app = FastAPI(title="LearnLoop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(courses.router, prefix="/api", tags=["courses"])
app.include_router(ingestion.router, prefix="/api", tags=["ingestion"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(quiz.router, prefix="/api", tags=["quiz"])
app.include_router(learner.router, prefix="/api", tags=["learner"])
app.include_router(insights.router, prefix="/api", tags=["insights"])
app.include_router(notebook.router, prefix="/api", tags=["notebook"])

@app.get("/")
def read_root():
    return {"message": "Welcome to LearnLoop API"}

