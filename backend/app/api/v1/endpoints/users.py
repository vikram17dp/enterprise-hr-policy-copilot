import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_auth_user,
    get_current_user,
)
from app.db.database import get_db
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message
from app.models.saved_answer import SavedAnswer
from app.models.user import User
from app.services.cloudinary_service import (
    delete_by_public_id,
    upload_avatar,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

# Profile-image upload limits (server-enforced; the client mirrors these).
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}


class UpdateProfile(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }


@router.get("/me")
def get_my_profile(
    current_user=Depends(
        get_current_auth_user
    ),
    db: Session = Depends(get_db),
):
    auth_user_id = current_user.get("sub")

    result = db.execute(
        select(User).where(
            User.auth_user_id == auth_user_id
        )
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return _serialize_user(user)


@router.put("/me")
def update_my_profile(
    payload: UpdateProfile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the editable profile fields. Email and role are authoritative
    from Supabase / the database and are not editable here."""
    current_user.full_name = payload.full_name.strip()

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return _serialize_user(current_user)


@router.post("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload/change the signed-in user's profile picture.

    Flow: browser -> this endpoint -> Cloudinary -> store ONLY the secure URL
    (+ public_id) on the user's own row -> return the updated profile.

    Ownership: the row comes from the authenticated JWT (get_current_user), so a
    user can only ever update their own avatar — no user id is accepted from the
    request body. The Cloudinary API secret stays server-side.
    """
    # --- Validate before spending an upload ---
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type. Please upload a JPG, PNG, or WEBP.",
        )

    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="The selected file is empty.")

    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image is too large. Please choose a file under 5 MB.",
        )

    # --- Upload to Cloudinary (server-side credentials) ---
    try:
        result = upload_avatar(data)
    except Exception as exc:  # noqa: BLE001 - do not leak internals to client
        logger.exception("Cloudinary avatar upload failed for user %s", current_user.id)
        raise HTTPException(
            status_code=502,
            detail="Could not upload the image. Please try again.",
        ) from exc

    previous_public_id = current_user.avatar_public_id

    # --- Persist ONLY the Cloudinary URL / public_id ---
    current_user.avatar_url = result["secure_url"]
    current_user.avatar_public_id = result["public_id"]

    db.add(current_user)
    try:
        db.commit()
        db.refresh(current_user)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.exception("Failed to save avatar for user %s", current_user.id)
        raise HTTPException(
            status_code=500,
            detail="Could not save your profile picture. Please try again.",
        ) from exc

    # --- Best-effort cleanup of the OLD image, only after success ---
    if previous_public_id and previous_public_id != result["public_id"]:
        delete_by_public_id(previous_public_id)

    return _serialize_user(current_user)


@router.get("/me/stats")
def get_my_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Real aggregated counts for the employee dashboard. No fabricated
    numbers — every value is counted from the database."""
    questions_asked = db.execute(
        select(func.count(Message.id))
        .join(
            Conversation,
            Conversation.id == Message.conversation_id,
        )
        .where(
            Conversation.user_id == current_user.id,
            Message.role == "user",
        )
    ).scalar_one()

    conversations = db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.user_id == current_user.id
        )
    ).scalar_one()

    saved_answers = db.execute(
        select(func.count(SavedAnswer.id)).where(
            SavedAnswer.user_id == current_user.id
        )
    ).scalar_one()

    documents_available = db.execute(
        select(func.count(Document.id))
    ).scalar_one()

    return {
        "questionsAsked": questions_asked,
        "savedAnswers": saved_answers,
        "conversations": conversations,
        "documentsAvailable": documents_available,
    }
