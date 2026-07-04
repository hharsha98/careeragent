"""All tunable knobs in one place — ported from ai-rag-project's rag/config.py.

pydantic-settings reads values from environment variables (and a local .env file
in development). On Hugging Face Spaces the same names are set as Space secrets.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Secrets (never committed; .env locally, host secrets in prod) ---
    mistral_api_key: str = ""
    groq_api_key: str = ""
    tavily_api_key: str = ""
    database_url: str = ""          # Supabase Postgres pooler URL (added on D2)
    supabase_jwt_secret: str = ""   # for owner login verification (added on D6)

    # --- Environment ---
    env: str = "dev"                            # "dev" or "prod"
    frontend_origin: str = "http://localhost:5173"  # CORS allowlist

    # --- Models (same choices as ai-rag-project, they work) ---
    embed_model: str = "mistral-embed"            # 1024-dim vectors
    chat_model: str = "mistral-small-latest"      # RAG answers
    agent_model: str = "llama-3.3-70b-versatile"  # Groq: fast + function calling
    mistral_base_url: str = "https://api.mistral.ai/v1"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # --- Chunking / retrieval (carried over from project 1) ---
    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 4


settings = Settings()
