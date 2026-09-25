"""Saved answers endpoints (employee-scoped).

Lets an employee bookmark assistant answers and retrieve them later. All
queries are filtered by the authenticated user's internal id.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.saved_answer import SavedAnswer
from app.models.user import User

router = APIRouter(
    prefix="/saved-answers",
    tags=["Saved Answers"],
)


class SavedAnswerCreate(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    source: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    conversationId: str | None = None
    messageId: str | None = None


def _optional_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _serialize(saved: SavedAnswer) -> dict:
    return {
        "id": str(saved.id),
        "question": saved.question,
        "answer": saved.answer,
        "source": saved.source,
        "category": saved.category,
        "savedAt": (
            saved.created_at.isoformat()
            if saved.created_at is not None
            else None
        ),
    }


@router.get("")
def list_saved_answers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = db.execute(
        select(SavedAnswer)
        .where(SavedAnswer.user_id == current_user.id)
        .order_by(SavedAnswer.created_at.desc())
    ).scalars().all()

    return [_serialize(item) for item in saved]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_saved_answer(
    payload: SavedAnswerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = SavedAnswer(
        user_id=current_user.id,
        question=payload.question.strip(),
        answer=payload.answer.strip(),
        source=payload.source,
        category=payload.category,
        conversation_id=_optional_uuid(payload.conversationId),
        message_id=_optional_uuid(payload.messageId),
    )

    db.add(saved)
    db.commit()
    db.refresh(saved)

    return _serialize(saved)


@router.delete("/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_answer(
    saved_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        parsed = uuid.UUID(str(saved_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid saved answer id",
        )

    saved = db.execute(
        select(SavedAnswer).where(
            SavedAnswer.id == parsed,
            SavedAnswer.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved answer not found",
        )

    db.delete(saved)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
