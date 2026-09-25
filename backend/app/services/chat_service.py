"""Chat orchestration service.

Bridges the HTTP layer and the LangGraph agentic RAG workflow
(`app.rag.workflow.ask`). It resolves/creates the conversation, runs the real
retrieval-augmented pipeline, persists the user + assistant messages, and
returns a structured result for the frontend.

There is NO mock or fallback answer here: if the RAG pipeline (Pinecone,
embeddings, or the LLM) cannot run, a `RagUnavailableError` is raised so the
API layer can return a proper 503 instead of fake data.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.rag.workflow import ask as run_agent

logger = logging.getLogger(__name__)


class RagUnavailableError(Exception):
    """The RAG pipeline could not produce an answer (external service down,
    missing credentials, index error, etc.)."""


def _parse_conversation_id(conversation_id: str | None) -> uuid.UUID | None:
    if conversation_id is None or str(conversation_id).strip() == "":
        return None
    try:
        return uuid.UUID(str(conversation_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("conversation_id is not a valid UUID") from exc


def _resolve_conversation(
    db: Session,
    user_id: uuid.UUID,
    conversation_id: str | None,
) -> Conversation:
    """Return an existing owned conversation, or create a new one."""
    parsed = _parse_conversation_id(conversation_id)

    if parsed is not None:
        conversation = db.execute(
            select(Conversation).where(
                Conversation.id == parsed,
                Conversation.user_id == user_id,
            )
        ).scalar_one_or_none()

        if conversation is None:
            # The id was supplied but does not exist / is not owned by the user.
            raise LookupError("Conversation not found")

        return conversation

    conversation = Conversation(user_id=user_id, title=None)
    db.add(conversation)
    db.flush()  # assigns conversation.id
    return conversation


def _recent_history(
    db: Session,
    conversation: Conversation,
    limit: int = 6,
) -> list[dict]:
    """Load a BOUNDED slice of prior turns for conversational context.

    Used only to resolve references like "next week"/"that" during intent
    classification. Never includes credentials or sensitive fields.
    """
    rows = db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    ).scalars().all()

    # rows are newest-first; reverse to chronological order
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(rows)
    ]
    return history


def _public_sources(citations: list[dict]) -> list[dict]:
    """Project citations down to the precise source metadata the frontend needs,
    de-duplicated. Internal KB sources carry chunk_id + score; web sources carry
    url + domain."""
    sources: list[dict] = []
    seen = set()
    for c in citations or []:
        key = c.get("chunk_id") or c.get("url") or c.get("title")
        if not key or key in seen:
            continue
        seen.add(key)
        source = {
            "title": c.get("title"),
            "type": c.get("type"),
            "url": c.get("url") or None,
        }
        if c.get("type") == "web":
            source["domain"] = c.get("domain")
        else:
            source["document"] = c.get("document") or c.get("title")
            source["chunk_id"] = c.get("chunk_id")
            source["score"] = c.get("relevance_score")
        sources.append(source)
    return sources



def ask_question(
    db: Session,
    user: User,
    message: str,
    conversation_id: str | None = None,
) -> dict:
    """Run the real RAG pipeline for `message` and persist the exchange.

    Returns a dict matching the frontend contract:
        { answer, conversation_id, message_id, source_used, citations }
    """
    question = (message or "").strip()
    if not question:
        raise ValueError("Message cannot be empty")

    # Resolve ownership / create the conversation BEFORE spending RAG calls.
    conversation = _resolve_conversation(db, user.id, conversation_id)

    # Bounded prior turns for conversational context (reference resolution).
    history = _recent_history(db, conversation)

    # --- Real agentic RAG (LangGraph -> embeddings -> Pinecone -> LLM) ---
    try:
        result = run_agent(question, history=history)
    except Exception as exc:  # noqa: BLE001 - mapped to 503 by the API layer
        db.rollback()
        logger.exception("RAG pipeline failed for user %s", user.id)
        raise RagUnavailableError(str(exc)) from exc

    answer = (result.get("answer") or "").strip()
    source_used = result.get("source_used") or ""
    source_type = result.get("source_type") or ""
    citations = result.get("citations") or []
    intent = result.get("intent") or ""
    requires_employee_data = bool(result.get("requires_employee_data"))
    requires_action = bool(result.get("requires_action"))

    if not answer:
        db.rollback()
        raise RagUnavailableError("The RAG pipeline returned an empty answer")

    # --- Persist the exchange ---
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=question,
    )
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        # `source` column is String(50); source_used values are short slugs.
        source=(source_used[:50] if source_used else None),
    )

    db.add(user_message)
    db.add(assistant_message)

    if not conversation.title:
        conversation.title = question[:80].strip()

    db.commit()
    db.refresh(conversation)
    db.refresh(assistant_message)

    return {
        "answer": answer,
        "conversation_id": str(conversation.id),
        "message_id": str(assistant_message.id),
        "source_used": source_used,
        "source_type": source_type,
        "intent": intent,
        "requires_employee_data": requires_employee_data,
        "requires_action": requires_action,
        "citations": citations,
        "sources": _public_sources(citations),
    }
