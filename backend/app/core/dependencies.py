from fastapi import Depends

from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import (
    security,
    verify_access_token,
)


def get_current_auth_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    payload = verify_access_token(credentials)

    return payload