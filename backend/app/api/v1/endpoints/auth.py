from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.services.auth_service import get_or_create_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.get("/me")
def get_me(
    current_user=Depends(get_current_user),
):
    return {
        "user": current_user
    }


@router.post("/sync-user")
def sync_user(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_user_id = current_user.get("sub")
    email = current_user.get("email")

    user = get_or_create_user(
        db=db,
        auth_user_id=auth_user_id,
        email=email,
    )

    return {
        "id": str(user.id),
        "auth_user_id": str(user.auth_user_id),
        "email": user.email,
        "role": user.role,
    }