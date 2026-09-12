from app.core.config import get_settings
from app.ra.vectorstore import get_vectorstore


settings = get_settings()


def get_retriever():
    return get_vectorstore().as_retriever(
        search_kwargs={
            "k": settings.top_k
        }
    )