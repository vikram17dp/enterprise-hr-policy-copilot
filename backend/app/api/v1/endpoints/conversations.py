"""Conversation history endpoints (employee-scoped).

All queries are filtered by the authenticated user's internal id, so a user
can only ever see or delete their own conversations.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _get_owned_conversation(
    db: Session, user: User, conversation_id: str
) -> Conversation:
    try:
        parsed = uuid.UUID(str(conversation_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid conversation id",
        )

    conversation = db.execute(
        select(Conversation).where(
            Conversation.id == parsed,
            Conversation.user_id == user.id,
        )
    ).scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return conversation


@router.get("")
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    ).scalars().all()

    result = []
    for conversation in conversations:
        message_count = db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conversation.id
            )
        ).scalar_one()

        last_question = db.execute(
            select(Message.content)
            .where(
                Message.conversation_id == conversation.id,
                Message.role == "user",
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()

        result.append(
            {
                "id": str(conversation.id),
                "title": conversation.title,
                "lastQuestion": last_question,
                "messageCount": message_count,
                "createdAt": _iso(conversation.created_at),
                "updatedAt": _iso(conversation.updated_at),
                "status": "active",
            }
        )

    return result


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _get_owned_conversation(db, current_user, conversation_id)

    messages = db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    ).scalars().all()

    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "lastQuestion": next(
            (m.content for m in reversed(messages) if m.role == "user"),
            None,
        ),
        "messageCount": len(messages),
        "createdAt": _iso(conversation.created_at),
        "updatedAt": _iso(conversation.updated_at),
        "status": "active",
        "messages": [
            {
                "id": str(message.id),
                "role": message.role,
                "content": message.content,
                "createdAt": _iso(message.created_at),
                "status": "complete",
                "sourceUsed": message.source,
            }
            for message in messages
        ],
    }


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _get_owned_conversation(db, current_user, conversation_id)

    # Messages cascade-delete via the FK (ondelete="CASCADE").
    db.delete(conversation)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
