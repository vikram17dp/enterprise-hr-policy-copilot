import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SystemSetting(Base):
    """A single editable, NON-SECRET admin setting (key/value).

    Only whitelisted keys are ever written here (see endpoints/admin.py).
    Secrets (API keys, DB/Redis/Cloudinary credentials) remain environment
    variables and are never stored in this table nor returned by the API.
    """

    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
    )

    value: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
