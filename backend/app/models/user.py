import uuid
from datetime import datetime

from sqlalchemy import String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    auth_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="employee",
    )

    # Cloudinary profile picture. Only the secure URL is stored here (the image
    # binary lives in Cloudinary). `avatar_public_id` is kept so a replaced
    # avatar's previous image can be deleted server-side after a successful
    # new upload.
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    avatar_public_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )