from functools import lru_cache

#from langchain_huggingface import HuggingFaceEmbeddings
from langchain_cohere  import CohereEmbeddings
from app.core.config import get_settings


settings = get_settings()


@lru_cache
def get_embeddings():
    return CohereEmbeddings(
        model=settings.embedding_model,
        cohere_api_key=settings.cohere_api_key,
    )