# LearnLoop

Source-grounded adaptive AI tutor.

## Phase 1: Data Model & Ingestion Setup

- FastAPI backend configured.
- PostgreSQL + pgvector database via Docker.
- SQLAlchemy models created for Users, Courses, Sources, Chunks, Topics, Concepts, etc.
- Ingestion upload endpoint implemented.

## Getting Started
1. Copy `.env.example` to `.env` and fill in your Gemini API key.
2. Run `docker-compose up -d --build`
