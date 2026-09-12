import time

from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

from app.core.config import get_settings
from app.rag.embeddings import get_embeddings


settings = get_settings()

_vectorstore = None



def ensure_index():
    if not settings.pinecone_api_key:
        raise RuntimeError("PINECONE_API_KEY is missing")

    pc = Pinecone(api_key=settings.pinecone_api_key)

    index_name = settings.pinecone_index_name

    existing_indexes = [x["name"] for x in pc.list_indexes()]

    if index_name not in existing_indexes:
        pc.create_index(
            name=index_name,
            dimension=settings.embedding_dimension,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1",
            ),
        )

        while not pc.describe_index(index_name).status["ready"]:
            time.sleep(1)

    return pc.Index(index_name)


def get_vectorstore():
    global _vectorstore

    if _vectorstore is None:
        index = ensure_index()

        _vectorstore = PineconeVectorStore(
            index=index,
            embedding=get_embeddings(),
            namespace=settings.pinecone_namespace,
        )

    return _vectorstore


def add_documents(chunks):
    vectorstore = get_vectorstore()

    return vectorstore.add_documents(chunks)