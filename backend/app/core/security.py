import jwt
from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import get_settings


settings = get_settings()

security = HTTPBearer()


def verify_token(
    credentials: HTTPAuthorizationCredentials,
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            options={
                "verify_signature": False
            },
        )

        return payload

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )