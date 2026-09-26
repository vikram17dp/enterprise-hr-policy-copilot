"""Chat endpoint — the single, real entry point for HR policy questions.

POST /api/v1/chat/ask
    Request:  { "message": str, "conversation_id"?: str }
    Response: { "answer", "conversation_id", "message_id", "answer_source",
                "source_used", "execution_trace": [str],
                "sources"/"citations": [{ "title", "type", "url",
                                "document"?, "chunk_id"?, "score"? |
                                "domain"? }] }

The answer is produced by the LangGraph agentic RAG workflow — a fixed nine-node
graph: Router (decompose the question into information requirements) -> Retrieve
(Pinecone) -> Grade KB (per requirement) -> [supported/partial: Generate KB
Answer, then Tavily only for still-missing PUBLIC requirements | all missing:
Tavily or Query Rewrite & Retry] -> Grade Web (per requirement) -> Generate Web
Answer -> Final Answer (merge KB + web + unresolved). The private HR knowledge
base is ALWAYS attempted before Tavily; Tavily is a fallback used only for
public/current requirements and never overrides company policy. `answer_source`
is one of "INTERNAL_KB" | "WEB" | "INTERNAL_KB + WEB" | "insufficient". No mock
data is ever returned; pipeline failures surface as HTTP 503.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.services.chat_service import (
    RagUnavailableError,
    ask_question,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)


class ChatAskRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="The employee's HR policy question.",
    )
    conversation_id: str | None = Field(
        default=None,
        description="Optional existing conversation id to continue.",
    )


@router.post("/ask")
def chat_ask(
    payload: ChatAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return ask_question(
            db=db,
            user=current_user,
            message=payload.message,
            conversation_id=payload.conversation_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except RagUnavailableError as exc:
        logger.error("RAG unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The HR knowledge service is temporarily unavailable. "
                "Please try again in a moment."
            ),
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error during chat ask")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while processing your question.",
        )
