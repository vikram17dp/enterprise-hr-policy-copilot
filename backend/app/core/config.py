from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):

    # Application
    app_name: str = "Enterprise HR Policy Agentic RAG Copilot"
    app_env: str = "development"

    # Local sample knowledge base
    sample_kb_dir: str = "data/sample_kb"

    # LLM / Search
    groq_api_key: str = ""
    tavily_api_key: str = ""
    openai_api_key: str = ""

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "enterprise-hr-policy-copilot"
    pinecone_namespace: str = "hr-policies"

    # Embeddings
    # embedding_model: str = "text-embedding-3-small"
    # Embeddings
    #embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    embedding_model: str = "embed-v4.0"
    cohere_api_key: str = ""
    embedding_dimension: int

    # RAG
    top_k: int = 5
    max_retries: int = 2

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