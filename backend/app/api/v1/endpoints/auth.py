from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_auth_user
from app.db.database import get_db
from app.services.auth_service import get_or_create_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.get("/me")
def get_me(
    current_auth_user=Depends(
        get_current_auth_user
    ),
):
    return {
        "auth_user_id": current_auth_user.get("sub"),
        "email": current_auth_user.get("email"),
    }


@router.post("/sync-user")
def sync_user(
    current_auth_user=Depends(
        get_current_auth_user
    ),
    db: Session = Depends(get_db),
):
    auth_user_id = current_auth_user.get("sub")
    email = current_auth_user.get("email")

    user_metadata = current_auth_user.get(
        "user_metadata",
        {}
    )

    full_name = user_metadata.get("full_name")

    user = get_or_create_user(
        db=db,
        auth_user_id=auth_user_id,
        email=email,
        full_name=full_name,
    )

    return {
        "id": str(user.id),
        "auth_user_id": str(user.auth_user_id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
    }