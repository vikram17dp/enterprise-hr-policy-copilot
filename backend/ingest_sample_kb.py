from pathlib import Path

from app.core.config import get_settings
from app.services.ingestion import load_file, chunk_documents
from app.rag.vectorstore import add_documents


settings = get_settings()


def ingest_local_documents():
    folder = Path(settings.sample_kb_dir)

    if not folder.exists():
        raise FileNotFoundError(
            f"Sample knowledge base not found: {folder}"
        )

    files = [
        path
        for path in folder.iterdir()
        if path.is_file()
    ]

    if not files:
        print("No documents found in sample knowledge base.")
        return

    all_documents = []

    for file_path in files:
        print(f"Loading: {file_path.name}")

        documents = load_file(file_path)
        all_documents.extend(documents)

    chunks = chunk_documents(all_documents)

    print(f"Loaded {len(files)} files")
    print(f"Created {len(chunks)} chunks")

    ids = add_documents(chunks)

    print(
        f"Indexed {len(files)} files → "
        f"{len(chunks)} chunks → "
        f"{len(ids)} Pinecone vectors"
    )


if __name__ == "__main__":
    ingest_local_documents()