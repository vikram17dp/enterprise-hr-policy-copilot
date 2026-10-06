"""Policy-document ingestion service (admin).

Orchestrates the EXISTING pipeline — it does not reimplement RAG ingestion:

    upload bytes -> temp file -> ingestion.load_file -> ingestion.chunk_documents
        -> rag.vectorstore.add_documents (Cohere embed -> Pinecone upsert ->
           Redis answer-cache invalidate)

Cloudinary storage (for later download / replace-from-storage) is attempted
best-effort: if the Cloudinary credential lacks upload permission, the document
is still ingested into Pinecone so RAG keeps working, and the failure is
surfaced as a warning rather than aborting.

Deletion removes the document's Pinecone vectors via a metadata filter on the
stable `document_id` (== Document.source_key), mirroring scripts/replace_document.py.
"""

import logging
import os
import tempfile
from pathlib import Path

import cloudinary.uploader

from app.core.config import get_settings
from app.rag import vectorstore
from app.services import cloudinary_service
from app.services.ingestion import SUPPORTED, chunk_documents, load_file
from app.services.redis_service import RedisService


logger = logging.getLogger(__name__)
settings = get_settings()


class IngestionError(Exception):
    """A user-facing ingestion failure (bad type, empty/unreadable document)."""


def supported_extensions() -> list[str]:
    return sorted(SUPPORTED)


def _write_temp(data: bytes, filename: str) -> Path:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in SUPPORTED:
        raise IngestionError(
            f"Unsupported file type '{suffix or 'unknown'}'. "
            f"Supported: {', '.join(supported_extensions())}."
        )
    if not data:
        raise IngestionError("The uploaded file is empty.")

    fd, tmp = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)
    return Path(tmp)


def ingest_bytes(
    data: bytes,
    filename: str,
    *,
    source_key: str,
    title: str,
    category: str | None,
) -> int:
    """Chunk + embed + upsert into Pinecone. Returns the number of vectors.

    Raises IngestionError for unsupported/empty/unreadable input; other
    exceptions (Pinecone/Cohere) propagate so the caller can mark the document
    'failed' and report a real error.
    """
    tmp = _write_temp(data, filename)
    try:
        docs = load_file(tmp)
        chunks = chunk_documents(docs)
        if not chunks:
            raise IngestionError("No extractable text was found in the document.")

        for chunk in chunks:
            chunk.metadata = {
                **(chunk.metadata or {}),
                "document_id": source_key,
                "title": title,
                "category": category or "",
                "source": filename,
                "text": chunk.page_content,
                "is_current": True,
            }

        ids = vectorstore.add_documents(chunks)
        logger.info(
            "Ingested document '%s' (%s): %d chunks -> %d vectors",
            title, source_key, len(chunks), len(ids or []),
        )
        return len(ids or [])
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


def ingest_path(
    path: Path,
    *,
    source_key: str,
    title: str,
    category: str | None,
) -> int:
    """Ingest from an existing file path (used by the reindex maintenance job)."""
    docs = load_file(path)
    chunks = chunk_documents(docs)
    if not chunks:
        raise IngestionError(f"No extractable text in {path.name}.")
    for chunk in chunks:
        chunk.metadata = {
            **(chunk.metadata or {}),
            "document_id": source_key,
            "title": title,
            "category": category or "",
            "source": path.name,
            "text": chunk.page_content,
            "is_current": True,
        }
    ids = vectorstore.add_documents(chunks)
    return len(ids or [])


def delete_vectors(source_key: str | None) -> bool:
    """Delete a document's Pinecone vectors by `document_id`. Best-effort.

    Returns True on success, False if it could not be completed (never raises).
    Invalidates the Redis answer cache because the KB changed.
    """
    if not source_key:
        return False
    try:
        index = vectorstore.ensure_index()
        index.delete(
            filter={"document_id": {"$eq": source_key}},
            namespace=settings.pinecone_namespace,
        )
        RedisService.invalidate_answers()
        logger.info("Deleted Pinecone vectors for document_id=%s", source_key)
        return True
    except Exception:  # noqa: BLE001
        logger.warning(
            "Could not delete Pinecone vectors for document_id=%s",
            source_key, exc_info=True,
        )
        return False


def upload_to_cloudinary(path: Path) -> dict | None:
    """Store the original file in Cloudinary (best-effort). Returns metadata or
    None if storage is unavailable (e.g. credential lacks upload permission)."""
    try:
        return cloudinary_service.upload_document(str(path))
    except Exception:  # noqa: BLE001
        logger.warning(
            "Cloudinary document upload unavailable for %s", path.name, exc_info=True
        )
        return None


def upload_bytes_to_cloudinary(data: bytes, filename: str) -> dict | None:
    tmp = None
    try:
        suffix = Path(filename or "").suffix.lower() or ".bin"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        tmp = Path(tmp_path)
        return upload_to_cloudinary(tmp)
    finally:
        if tmp is not None:
            try:
                tmp.unlink()
            except OSError:
                pass


def delete_from_cloudinary(public_id: str | None) -> None:
    """Best-effort destroy of a stored document (documents are 'raw' resources;
    fall back to 'image' just in case). Never raises."""
    if not public_id:
        return
    for resource_type in ("raw", "image", "auto"):
        try:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            return
        except Exception:  # noqa: BLE001
            continue
    logger.warning("Could not delete Cloudinary document %s", public_id)
