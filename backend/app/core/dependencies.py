from fastapi import Depends, HTTPException, status

from fastapi.security import HTTPAuthorizationCredentials

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    security,
    verify_access_token,
)
from app.db.database import get_db
from app.models.user import User


def get_current_auth_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    payload = verify_access_token(credentials)

    return payload


def get_current_user(
    current_auth_user: dict = Depends(get_current_auth_user),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the internal `users` row for the authenticated Supabase user.

    The JWT `sub` claim is the Supabase auth id, which maps to
    `users.auth_user_id`. The database is the authoritative source of the
    user's role and identity.
    """
    auth_user_id = current_auth_user.get("sub")

    user = db.execute(
        select(User).where(User.auth_user_id == auth_user_id)
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please sign in again.",
        )

    return user