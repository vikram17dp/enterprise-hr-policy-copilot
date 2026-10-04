"""Conversation history endpoints (employee-scoped).

All queries are filtered by the authenticated user's internal id, so a user
can only ever see or delete their own conversations.
"""

import uuid

import logging  # TEMP-LATENCY-DIAG (remove after diagnosis)
import time  # TEMP-LATENCY-DIAG (remove after diagnosis)
from pathlib import Path  # TEMP-LATENCY-DIAG (remove after diagnosis)

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
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

# ---- TEMP-LATENCY-DIAG (remove after diagnosis) -------------------------
_logger = logging.getLogger("latency.diag")
_DIAG_LOG = Path(__file__).resolve().parents[4] / "_latency_diag.log"


def _diag(line: str) -> None:
    """Emit a temporary timing line to the server log AND a scratch file."""
    _logger.info(line)
    try:
        with _DIAG_LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"{time.strftime('%H:%M:%S')} {line}\n")
    except OSError:
        pass
# ---- end TEMP-LATENCY-DIAG ----------------------------------------------


class RenameConversationRequest(BaseModel):
    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="The new title for the conversation.",
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
    request: Request,  # TEMP-LATENCY-DIAG (remove after diagnosis)
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # TEMP-LATENCY-DIAG (remove after diagnosis): per-phase timing.
    _auth_ms = getattr(request.state, "diag_auth_ms", 0.0)
    _verify_ms = getattr(request.state, "diag_verify_ms", 0.0)
    _user_sel_ms = getattr(request.state, "diag_user_select_ms", 0.0)
    _t0 = getattr(request.state, "diag_t0", time.perf_counter())

    _t = time.perf_counter()
    conversations = db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    ).scalars().all()
    _list_ms = (time.perf_counter() - _t) * 1000.0

    _counts_ms = 0.0
    _lastq_ms = 0.0
    _transform_ms = 0.0
    result = []
    for conversation in conversations:
        _t = time.perf_counter()
        message_count = db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conversation.id
            )
        ).scalar_one()
        _counts_ms += (time.perf_counter() - _t) * 1000.0

        _t = time.perf_counter()
        last_question = db.execute(
            select(Message.content)
            .where(
                Message.conversation_id == conversation.id,
                Message.role == "user",
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        _lastq_ms += (time.perf_counter() - _t) * 1000.0

        _t = time.perf_counter()
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
        _transform_ms += (time.perf_counter() - _t) * 1000.0

    # TEMP-LATENCY-DIAG (remove after diagnosis)
    _db_ms = _list_ms + _counts_ms + _lastq_ms
    _total_ms = (time.perf_counter() - _t0) * 1000.0
    _diag(
        f"[CONVERSATIONS] auth: {_auth_ms:.0f} ms / supabase: {_db_ms:.0f} ms"
        f" / transform: {_transform_ms:.0f} ms / total: {_total_ms:.0f} ms"
    )
    _diag(
        f"[CONVERSATIONS][detail] jwks_verify: {_verify_ms:.0f} ms /"
        f" user_select(incl pool checkout+pre_ping): {_user_sel_ms:.0f} ms /"
        f" list_select: {_list_ms:.0f} ms / counts({len(conversations)}):"
        f" {_counts_ms:.0f} ms / last_question({len(conversations)}):"
        f" {_lastq_ms:.0f} ms / queries: {2 * len(conversations) + 2} /"
        f" rows: {len(conversations)}"
    )

    return result


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: str,
    request: Request,  # TEMP-LATENCY-DIAG (remove after diagnosis)
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # TEMP-LATENCY-DIAG (remove after diagnosis): per-phase timing.
    _auth_ms = getattr(request.state, "diag_auth_ms", 0.0)
    _verify_ms = getattr(request.state, "diag_verify_ms", 0.0)
    _user_sel_ms = getattr(request.state, "diag_user_select_ms", 0.0)
    _t0 = getattr(request.state, "diag_t0", time.perf_counter())

    _t = time.perf_counter()
    conversation = _get_owned_conversation(db, current_user, conversation_id)
    _conv_ms = (time.perf_counter() - _t) * 1000.0

    _t = time.perf_counter()
    messages = db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    ).scalars().all()
    _msg_ms = (time.perf_counter() - _t) * 1000.0

    _t = time.perf_counter()
    payload = {
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
    _transform_ms = (time.perf_counter() - _t) * 1000.0

    # TEMP-LATENCY-DIAG (remove after diagnosis)
    _db_ms = _conv_ms + _msg_ms
    _total_ms = (time.perf_counter() - _t0) * 1000.0
    _diag(
        f"[CONVERSATION_DETAIL] auth: {_auth_ms:.0f} ms / supabase:"
        f" {_db_ms:.0f} ms / transform: {_transform_ms:.0f} ms / total:"
        f" {_total_ms:.0f} ms"
    )
    _diag(
        f"[CONVERSATION_DETAIL][detail] jwks_verify: {_verify_ms:.0f} ms /"
        f" user_select(incl pool checkout+pre_ping): {_user_sel_ms:.0f} ms /"
        f" conversation_select: {_conv_ms:.0f} ms / messages_select:"
        f" {_msg_ms:.0f} ms / queries: 3 / messages: {len(messages)}"
    )

    return payload


@router.post("", status_code=status.HTTP_201_CREATED)
def create_conversation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an empty conversation owned by the authenticated user.

    The normal chat flow creates a conversation lazily on the first question
    (POST /chat/ask with no conversation_id); this endpoint exists for clients
    that want an explicit id up front (e.g. a "+ New Chat" that navigates to
    /chat/{id} before any message is sent).
    """
    conversation = Conversation(user_id=current_user.id, title=None)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "lastQuestion": None,
        "messageCount": 0,
        "createdAt": _iso(conversation.created_at),
        "updatedAt": _iso(conversation.updated_at),
        "status": "active",
    }


@router.get("/{conversation_id}/messages")
def list_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the messages of an owned conversation, oldest first."""
    conversation = _get_owned_conversation(db, current_user, conversation_id)

    messages = db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    ).scalars().all()

    return [
        {
            "id": str(message.id),
            "role": message.role,
            "content": message.content,
            "createdAt": _iso(message.created_at),
            "status": "complete",
            "sourceUsed": message.source,
        }
        for message in messages
    ]


@router.patch("/{conversation_id}")
def rename_conversation(
    conversation_id: str,
    payload: RenameConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename an owned conversation. Ownership is validated before the update."""
    conversation = _get_owned_conversation(db, current_user, conversation_id)

    conversation.title = payload.title.strip()[:255]
    db.commit()
    db.refresh(conversation)

    message_count = db.execute(
        select(func.count(Message.id)).where(
            Message.conversation_id == conversation.id
        )
    ).scalar_one()

    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "messageCount": message_count,
        "createdAt": _iso(conversation.created_at),
        "updatedAt": _iso(conversation.updated_at),
        "status": "active",
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
