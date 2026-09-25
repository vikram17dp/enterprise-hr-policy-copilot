from fastapi import APIRouter, Depends, HTTPException
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


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


class UpdateProfile(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
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
