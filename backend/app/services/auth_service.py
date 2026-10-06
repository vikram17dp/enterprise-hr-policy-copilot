import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.user import User


logger = logging.getLogger(__name__)

settings = get_settings()


def _is_configured_admin_email(email: str | None) -> bool:
    """True when `email` matches the ADMIN_EMAIL bootstrap address.

    Comparison is case-insensitive and only active when ADMIN_EMAIL is set.
    This never grants access on its own — Supabase Auth still authenticates the
    user; this only decides the initial/authoritative `users.role` value.
    """
    configured = (settings.admin_email or "").strip().lower()
    return bool(configured) and (email or "").strip().lower() == configured


def get_or_create_user(
    db: Session,
    auth_user_id,
    email: str,
    full_name: str | None = None,
):
    result = db.execute(
        select(User).where(
            User.auth_user_id == auth_user_id
        )
    )

    user = result.scalar_one_or_none()

    if user:
        # Keep the configured admin address promoted (idempotent). A manually
        # demoted admin stays demoted only if it no longer matches ADMIN_EMAIL.
        if _is_configured_admin_email(email) and user.role != "admin":
            user.role = "admin"
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info("Promoted user %s to admin (ADMIN_EMAIL match)", user.id)
        return user

    user = User(
        auth_user_id=auth_user_id,
        email=email,
        full_name=full_name,
        role="admin" if _is_configured_admin_email(email) else "employee",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user
