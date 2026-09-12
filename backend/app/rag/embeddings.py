from langchain_openai import OpenAIEmbeddings
from app.core.config import get_settings


settings = get_settings()

_embeddings = None


def get_embeddings():
    global _embeddings

    if _embeddings is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is missing")

        _embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=settings.openai_api_key,
        )

    return _embeddings