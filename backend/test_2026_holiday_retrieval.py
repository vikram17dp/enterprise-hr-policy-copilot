import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_cohere import CohereEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone


load_dotenv()


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

FILE_PATH = (
    BASE_DIR
    / "data"
    / "sample_kb"
    / "peopleprime_hr_holidays_and_leave_policy_2026.md"
)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
PINECONE_NAMESPACE = os.getenv(
    "PINECONE_NAMESPACE",
    "hr-policies"
)

COHERE_API_KEY = os.getenv("COHERE_API_KEY")

EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL"
)

EMBEDDING_DIMENSION = int(
    os.getenv(
        "EMBEDDING_DIMENSION",
        "1536"
    )
)


# ============================================================
# VALIDATION
# ============================================================

if not FILE_PATH.exists():
    raise FileNotFoundError(
        f"\nFile not found:\n{FILE_PATH}"
    )

if not PINECONE_API_KEY:
    raise ValueError(
        "PINECONE_API_KEY is missing"
    )

if not PINECONE_INDEX_NAME:
    raise ValueError(
        "PINECONE_INDEX_NAME is missing"
    )

if not COHERE_API_KEY:
    raise ValueError(
        "COHERE_API_KEY is missing"
    )

if not EMBEDDING_MODEL:
    raise ValueError(
        "EMBEDDING_MODEL is missing"
    )


# ============================================================
# PRINT CONFIG
# ============================================================

print("\n======================================")
print("2026 HOLIDAY POLICY INGESTION")
print("======================================\n")

print(f"File       : {FILE_PATH}")
print(f"Index      : {PINECONE_INDEX_NAME}")
print(f"Namespace  : {PINECONE_NAMESPACE}")
print(f"Embedding  : {EMBEDDING_MODEL}")
print(f"Dimension  : {EMBEDDING_DIMENSION}")
print()


# ============================================================
# READ ONLY THE 2026 FILE
# ============================================================

text = FILE_PATH.read_text(
    encoding="utf-8"
)

print(
    f"Loaded document: {len(text)} characters"
)


# ============================================================
# CREATE DOCUMENT
# ============================================================

document = Document(
    page_content=text,
    metadata={
        "source": FILE_PATH.name,
        "document_name": (
            "PeoplePrime HR Holiday & Leave Policy — 2026"
        ),
        "document_id": (
            "PEOPLEPRIME-HR-2026-LEAVE-HOLIDAY"
        ),
        "document_type": "hr_policy",
        "category": "holidays_and_leave",
        "year": 2026,
    },
)


# ============================================================
# SPLIT ONLY THIS DOCUMENT
# ============================================================

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=[
        "\n## ",
        "\n### ",
        "\n\n",
        "\n",
        ". ",
        " ",
    ],
)

chunks = text_splitter.split_documents(
    [document]
)

print(
    f"Created {len(chunks)} chunks"
)


# ============================================================
# ADD CHUNK METADATA
# ============================================================

for i, chunk in enumerate(chunks):

    chunk.metadata["chunk_id"] = i

    # Keep this EXACTLY the same as the retrieval filter.
    chunk.metadata["source"] = FILE_PATH.name

    chunk.metadata["document_id"] = (
        "PEOPLEPRIME-HR-2026-LEAVE-HOLIDAY"
    )


# ============================================================
# CREATE COHERE EMBEDDINGS
# ============================================================

print("\nCreating embedding model...")

embeddings = CohereEmbeddings(
    model=EMBEDDING_MODEL,
    cohere_api_key=COHERE_API_KEY,
)


# ============================================================
# VERIFY EMBEDDING DIMENSION
# ============================================================

test_embedding = embeddings.embed_query(
    "test embedding"
)

actual_dimension = len(
    test_embedding
)

print(
    f"Actual embedding dimension: "
    f"{actual_dimension}"
)

if actual_dimension != EMBEDDING_DIMENSION:
    raise ValueError(
        f"Embedding dimension mismatch!\n"
        f"Expected: {EMBEDDING_DIMENSION}\n"
        f"Actual: {actual_dimension}"
    )

print("Embedding dimension: OK")


# ============================================================
# CONNECT TO PINECONE
# ============================================================

print("\nConnecting to Pinecone...")

pc = Pinecone(
    api_key=PINECONE_API_KEY
)

index = pc.Index(
    PINECONE_INDEX_NAME
)


# ============================================================
# VERIFY INDEX
# ============================================================

index_info = pc.describe_index(
    PINECONE_INDEX_NAME
)

print(
    f"Pinecone dimension: "
    f"{index_info['dimension']}"
)

if index_info["dimension"] != actual_dimension:
    raise ValueError(
        "Pinecone and embedding dimensions do not match!"
    )


# ============================================================
# CREATE VECTOR STORE
# ============================================================

vectorstore = PineconeVectorStore(
    index=index,
    embedding=embeddings,
    namespace=PINECONE_NAMESPACE,
)


# ============================================================
# INSERT ONLY THESE CHUNKS
# ============================================================

print(
    "\nUploading ONLY "
    "peopleprime_hr_holidays_and_leave_policy_2026.md..."
)

ids = [
    f"peopleprime-hr-2026-{i}"
    for i in range(len(chunks))
]

vectorstore.add_documents(
    documents=chunks,
    ids=ids
)


# ============================================================
# DONE
# ============================================================

print("\n======================================")
print("INGESTION COMPLETE")
print("======================================")

print(
    f"Document  : {FILE_PATH.name}"
)

print(
    f"Chunks    : {len(chunks)}"
)

print(
    f"Namespace : {PINECONE_NAMESPACE}"
)

print(
    f"Index     : {PINECONE_INDEX_NAME}"
)

print(
    "\nONLY the 2026 holiday/leave document "
    "was ingested."
)