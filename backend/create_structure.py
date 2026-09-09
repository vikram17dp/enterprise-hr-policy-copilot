from pathlib import Path

# Root = current backend folder
root = Path(".")

# Folders
folders = [
    "app",
    "app/api",
    "app/core",
    "app/rag",
    "app/services",
    "data",
    "data/policies",
    "templates",
    "static",
    "uploads",
    "tests",
]

# Files
files = [
    "app/__init__.py",
    "app/main.py",

    "app/api/__init__.py",
    "app/api/routes.py",

    "app/core/__init__.py",
    "app/core/config.py",

    "app/rag/__init__.py",
    "app/rag/loader.py",
    "app/rag/splitter.py",
    "app/rag/embeddings.py",
    "app/rag/vectorstore.py",
    "app/rag/retriever.py",
    "app/rag/graph.py",

    "app/services/__init__.py",
    "app/services/chat_service.py",

    "tests/__init__.py",
]

# Create folders
for folder in folders:
    (root / folder).mkdir(parents=True, exist_ok=True)

# Create files
for file in files:
    (root / file).touch(exist_ok=True)

print("Backend project structure created successfully.")