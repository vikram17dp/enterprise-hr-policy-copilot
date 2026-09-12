from app.services.ingestion import load_file,chunck_documents
from pathlib import Path

docs = load_file(Path("data/sample_kb/company_hr_handbook.md"))
chunked_docs = chunck_documents(docs)
print(len(chunked_docs))


