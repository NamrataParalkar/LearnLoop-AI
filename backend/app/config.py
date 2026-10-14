from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://tutor:password@localhost/learnloop"
    tutor_model: str = "gemini-3.5-flash"
    verifier_model: str = "gemini-3.5-flash"
    gemini_api_key: str = ""
    embed_dim: int = 1024
    whisper_model: str = "small"
    media_dir: str = "data/media"
    
    # Phase 2 Thresholds
    retrieve_top_k: int = 20
    rerank_top_n: int = 6
    refusal_score_threshold: float = 0.35
    max_context_tokens: int = 4000


    class Config:
        env_file = [".env", "../.env", "backend/.env"]
        extra = "ignore"

settings = Settings()
