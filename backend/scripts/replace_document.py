from pathlib import Path
from typing import List

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone
import cohere

from app.core.config import get_settings


settings = get_settings()

# --------------------------------------------------
# CONFIG
# --------------------------------------------------

INDEX_NAME = settings.pinecone_index_name
NAMESPACE = settings.pinecone_namespace

pc = Pinecone(api_key=settings.pinecone_api_key)
index = pc.Index(INDEX_NAME)

co = cohere.ClientV2(api_key=settings.cohere_api_key)

EMBEDDING_MODEL = settings.embedding_model
EXPECTED_DIMENSION = int(settings.embedding_dimension)


# --------------------------------------------------
# DOCUMENT CONFIG
# --------------------------------------------------

DOCUMENT_CONFIG = {
    "company_hr_handbook.md": {
        "document_id": "PEOPLEPRIME-HR-HANDBOOK",
        "document_name": "PeoplePrime Company HR Handbook",
        "document_type": "employee_handbook",
        "category": "hr_policy",
    },

    "hr_operations_runbook.md": {
        "document_id": "PEOPLEPRIME-HR-OPERATIONS-RUNBOOK",
        "document_name": "PeoplePrime HR Operations Runbook",
        "document_type": "hr_runbook",
        "category": "hr_operations",
    },

    "peopleprime_hr_holidays_and_leave_policy_2026.md": {
        "document_id": "PEOPLEPRIME-HR-2026-LEAVE-HOLIDAY",
        "document_name": "PeoplePrime HR Holiday & Leave Policy — 2026",
        "document_type": "hr_policy",
        "category": "holidays_and_leave",
    },
}


# --------------------------------------------------
# EMBEDDING
# --------------------------------------------------

def create_embeddings(texts: List[str]) -> List[List[float]]:
    response = co.embed(
        model=EMBEDDING_MODEL,
        input_type="search_document",
        texts=texts,
        embedding_types=["float"],
    )

    embeddings = response.embeddings.float

    for embedding in embeddings:
        if len(embedding) != EXPECTED_DIMENSION:
            raise ValueError(
                f"Embedding dimension mismatch. "
                f"Expected {EXPECTED_DIMENSION}, "
                f"got {len(embedding)}"
            )

    return embeddings


# --------------------------------------------------
# DELETE OLD DOCUMENT
# --------------------------------------------------

def delete_existing_document(document_id: str) -> None:
    print(f"\nDeleting existing document:")
    print(f"  document_id = {document_id}")

    index.delete(
        filter={
            "document_id": {
                "$eq": document_id
            }
        },
        namespace=NAMESPACE,
    )

    print("Old vectors deleted.")


# --------------------------------------------------
# LOAD DOCUMENT
# --------------------------------------------------

def load_document(file_path: Path) -> str:

    if not file_path.exists():
        raise FileNotFoundError(
            f"Document not found: {file_path}"
        )

    return file_path.read_text(
        encoding="utf-8"
    )


# --------------------------------------------------
# CHUNK DOCUMENT
# --------------------------------------------------

def create_chunks(
    text: str,
    metadata: dict,
) -> List[Document]:

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=[
            "\n\n",
            "\n",
            ". ",
            " ",
            "",
        ],
    )

    documents = splitter.create_documents(
        [text],
        metadatas=[metadata],
    )

    return documents


# --------------------------------------------------
# UPSERT
# --------------------------------------------------

def upsert_documents(
    documents: List[Document],
    document_id: str,
) -> None:

    texts = [
        document.page_content
        for document in documents
    ]

    embeddings = create_embeddings(texts)

    vectors = []

    for index_number, (
        document,
        embedding,
    ) in enumerate(
        zip(documents, embeddings)
    ):

        metadata = {
            **document.metadata,

            "document_id": document_id,

            "chunk_index": index_number,

            "is_current": True,

            "text": document.page_content,
        }

        vector = {
            "id": f"{document_id}-{index_number}",
            "values": embedding,
            "metadata": metadata,
        }

        vectors.append(vector)

    index.upsert(
        vectors=vectors,
        namespace=NAMESPACE,
    )

    print(
        f"Inserted {len(vectors)} vectors."
    )


# --------------------------------------------------
# REPLACE DOCUMENT
# --------------------------------------------------

def replace_document(
    file_path: Path,
) -> None:

    filename = file_path.name

    if filename not in DOCUMENT_CONFIG:
        raise ValueError(
            f"No document configuration found "
            f"for {filename}"
        )

    config = DOCUMENT_CONFIG[filename]

    document_id = config["document_id"]

    print("\n====================================")
    print("Replacing HR document")
    print("====================================")

    print(f"File: {filename}")
    print(f"Document ID: {document_id}")

    # ----------------------------------------------
    # 1. Delete old vectors
    # ----------------------------------------------

    delete_existing_document(
        document_id
    )

    # ----------------------------------------------
    # 2. Read document
    # ----------------------------------------------

    text = load_document(
        file_path
    )

    # ----------------------------------------------
    # 3. Metadata
    # ----------------------------------------------

    metadata = {
        "document_id": document_id,

        "source": filename,

        "document_name":
            config["document_name"],

        "document_type":
            config["document_type"],

        "category":
            config["category"],

        "version": 1,

        "is_current": True,
    }

    # ----------------------------------------------
    # 4. Chunk
    # ----------------------------------------------

    documents = create_chunks(
        text,
        metadata,
    )

    print(
        f"Created {len(documents)} chunks."
    )

    # ----------------------------------------------
    # 5. Embed + upsert
    # ----------------------------------------------

    upsert_documents(
        documents,
        document_id,
    )

    print(
        "\nDocument replacement completed."
    )


# --------------------------------------------------
# MAIN
# --------------------------------------------------

if __name__ == "__main__":

    data_dir = (
        Path(__file__)
        .resolve()
        .parent.parent
        / "data"
        / "sample_kb"
    )

    documents_to_replace = [
        data_dir / "company_hr_handbook.md",
        data_dir / "hr_operations_runbook.md",
    ]

    for file_path in documents_to_replace:

        replace_document(
            file_path
        )

    print("\nAll HR documents re-ingested successfully.")