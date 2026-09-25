from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):

    # Application
    app_name: str = "Enterprise HR Policy Agentic RAG Copilot"
    app_env: str = "development"

    # Local sample knowledge base
    sample_kb_dir: str = "data/sample_kb"

    # LLM / Search
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"
    tavily_api_key: str = ""
    openai_api_key: str = ""

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "enterprise-hr-policy-copilot"
    pinecone_namespace: str = "hr-policies"

    
    embedding_model: str = "embed-v4.0"
    cohere_api_key: str = ""
    embedding_dimension: int

    # RAG
    top_k: int = 5
    max_retries: int = 2
    # Minimum normalized relevance (0-1) for a retrieved chunk to be kept as
    # grounding evidence. A safety floor for larger knowledge bases; the sample
    # KB chunks all score well above this.
    retrieval_score_threshold: float = 0.35
    
    supabase_jwks_url: str = ""
    # Supabase
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_jwks_url: str = ""

    # PostgreSQL
    database_url: str = ""
    direct_url: str = ""

    # Cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Security
    admin_api_key: str = ""

    # Infrastructure
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    redis_url: str = "redis://localhost:6379"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()