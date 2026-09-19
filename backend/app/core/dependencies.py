from fastapi import Depends

from app.core.security import security, verify_token
from fastapi.security import HTTPAuthorizationCredentials


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    payload = verify_token(credentials)

    return payload