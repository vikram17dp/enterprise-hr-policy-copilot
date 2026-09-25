import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.document import Document
from app.models.user import User


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


def _serialize(document: Document) -> dict:
    """Map a Document row to the frontend PolicyDocument shape.

    The `documents` table has no `category` / `updated_at` columns, so those
    are returned as null rather than fabricated.
    """
    return {
        "id": str(document.id),
        "title": document.title,
        "filename": document.filename,
        "description": document.description,
        "category": None,
        "version": document.version,
        "status": document.status,
        "cloudinary_url": document.cloudinary_url,
        "created_at": (
            document.created_at.isoformat()
            if document.created_at is not None
            else None
        ),
    }


@router.get("")
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Employee read-only list of available policy documents."""
    documents = db.execute(
        select(Document).order_by(Document.created_at.desc())
    ).scalars().all()

    return [_serialize(document) for document in documents]


@router.get("/{document_id}")
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(str(document_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document id",
        )

    document = db.execute(
        select(Document).where(Document.id == parsed)
    ).scalar_one_or_none()

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return _serialize(document)


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    # NOTE: Admin document management (real upload + ingestion) is out of
    # scope for the employee experience and is intentionally left as-is.
    return {
        "filename": file.filename,
        "message": "Document upload received",
    }
