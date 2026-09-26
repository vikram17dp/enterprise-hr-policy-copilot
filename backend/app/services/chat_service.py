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


def ask_question(
    db: Session,
    user: User,
    message: str,
    conversation_id: str | None = None,
) -> dict:
    """Run the real RAG pipeline for `message` and persist the exchange.

    Returns a dict matching the frontend contract:
        { answer, conversation_id, message_id, answer_source, sources,
          execution_trace }
    """
    question = (message or "").strip()
    if not question:
        raise ValueError("Message cannot be empty")

    # Resolve ownership / create the conversation BEFORE spending RAG calls.
    conversation = _resolve_conversation(db, user.id, conversation_id)

    # --- Real agentic RAG (LangGraph -> embeddings -> Pinecone -> LLM) ---
    try:
        result = run_agent(question)
    except Exception as exc:  # noqa: BLE001 - mapped to 503 by the API layer
        db.rollback()
        logger.exception("RAG pipeline failed for user %s", user.id)
        raise RagUnavailableError(str(exc)) from exc

    answer = (result.get("answer") or "").strip()
    answer_source = result.get("answer_source") or "insufficient"
    sources = result.get("sources") or []
    execution_trace = result.get("execution_trace") or []

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
        # `source` column is String(50); answer_source is one of
        # INTERNAL_KB / WEB / INTERNAL_KB + WEB / insufficient.
        source=(answer_source[:50] if answer_source else None),
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
        "answer_source": answer_source,
        # `source_used` kept as an alias of answer_source for any existing
        # consumers; `citations` mirrors `sources` for the frontend.
        "source_used": answer_source,
        "sources": sources,
        "citations": sources,
        "execution_trace": execution_trace,
    }
