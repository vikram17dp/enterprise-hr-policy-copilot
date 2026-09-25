"""Employee feedback endpoint.

Supports both general experience feedback (no message) and answer-level
feedback (thumbs up/down tied to a specific assistant message).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.feedback import Feedback
from app.models.message import Message
from app.models.user import User

router = APIRouter(
    prefix="/feedback",
    tags=["Feedback"],
)


class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="1 (poor) to 5 (great)")
    comment: str | None = Field(default=None, max_length=4000)
    category: str | None = Field(default=None, max_length=50)
    message_id: str | None = Field(
        default=None,
        description="Optional assistant message this feedback refers to.",
    )


@router.post("")
def submit_feedback(
    payload: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message_uuid: uuid.UUID | None = None

    if payload.message_id:
        try:
            message_uuid = uuid.UUID(str(payload.message_id))
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid message_id",
            )

        exists = db.execute(
            select(Message.id).where(Message.id == message_uuid)
        ).scalar_one_or_none()

        if exists is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found",
            )

    feedback = Feedback(
        user_id=current_user.id,
        message_id=message_uuid,
        rating=str(payload.rating),
        category=payload.category,
        comment=(payload.comment or None),
    )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return {
        "id": str(feedback.id),
        "status": "received",
    }
