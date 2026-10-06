import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdminQueryMeta(Base):
    """Admin workflow state for an employee query (1:1 with a conversation).

    Kept in its OWN table rather than as columns on `conversations`/`messages`
    so the employee chat pipeline and its Row Level Security policies are never
    touched. A conversation with no row here is treated as status='open'.

    `conversation_id` is both the PK and an FK to conversations (CASCADE), so
    deleting a conversation removes its admin metadata automatically.
    """

    __tablename__ = "admin_query_meta"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # 'open' | 'in_progress' | 'resolved' | 'closed'
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        index=True,
    )

    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Internal admin note — NOT shown to the employee.
    admin_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
