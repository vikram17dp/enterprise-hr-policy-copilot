from functools import lru_cache

from langchain_huggingface import HuggingFaceEmbeddings

from app.core.config import get_settings


settings = get_settings()


@lru_cache
def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name=settings.embedding_model
    )