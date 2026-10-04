from fastapi import Depends, HTTPException, Request, status

from fastapi.security import HTTPAuthorizationCredentials

import time  # TEMP-LATENCY-DIAG (remove after diagnosis)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    security,
    verify_access_token,
)
from app.db.database import get_db
from app.models.user import User


def get_current_auth_user(
    request: Request,  # TEMP-LATENCY-DIAG (remove after diagnosis)
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    # TEMP-LATENCY-DIAG (remove after diagnosis): stamp request start + JWKS time.
    request.state.diag_t0 = time.perf_counter()
    _t = time.perf_counter()
    payload = verify_access_token(credentials)
    request.state.diag_verify_ms = (time.perf_counter() - _t) * 1000.0

    return payload


def get_current_user(
    request: Request,  # TEMP-LATENCY-DIAG (remove after diagnosis)
    current_auth_user: dict = Depends(get_current_auth_user),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the internal `users` row for the authenticated Supabase user.

    The JWT `sub` claim is the Supabase auth id, which maps to
    `users.auth_user_id`. The database is the authoritative source of the
    user's role and identity.
    """
    auth_user_id = current_auth_user.get("sub")

    # TEMP-LATENCY-DIAG (remove after diagnosis): includes pool checkout +
    # pool_pre_ping on first use of this session's connection.
    _t = time.perf_counter()
    user = db.execute(
        select(User).where(User.auth_user_id == auth_user_id)
    ).scalar_one_or_none()
    request.state.diag_user_select_ms = (time.perf_counter() - _t) * 1000.0
    request.state.diag_auth_ms = getattr(
        request.state, "diag_verify_ms", 0.0
    ) + request.state.diag_user_select_ms

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please sign in again.",
        )

    return user