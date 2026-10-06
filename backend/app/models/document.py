import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    version: Mapped[int] = mapped_column(
        nullable=False,
        default=1,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="processing",
    )

    # HR policy category (e.g. "holidays_and_leave"). Nullable: pre-existing
    # rows and the seeded KB may not have one.
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Stable Pinecone `document_id` used to filter-delete this document's
    # vectors on replace/delete (see scripts/replace_document.py). Nullable for
    # legacy rows that were never ingested through the admin pipeline.
    source_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    cloudinary_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    cloudinary_public_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )