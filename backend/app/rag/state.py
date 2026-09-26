"""LangGraph state + structured-output models for the HR Policy Copilot.

The workflow is a fixed 9-stage Agentic RAG graph:

    Router -> Retrieve (Pinecone) -> Grade KB
        -> [KB sufficient]  Generate KB Answer
        -> [KB insufficient] Web Search (Tavily) -> Grade Web
            -> [Web sufficient]  Generate Web Answer
            -> [Web insufficient] Query Rewrite & Retry -> back to Retrieve

The state carries ONLY what these stages need. No extra fields.
"""

from typing import List, Literal

from typing_extensions import TypedDict

from pydantic import BaseModel, Field

from langchain_core.documents import Document


# ============================================================
# ANSWER SOURCE
# ============================================================

# Where the final answer came from (surfaced to the client + logs).
ANSWER_SOURCE_KB = "kb"
ANSWER_SOURCE_WEB = "web"
ANSWER_SOURCE_INSUFFICIENT = "insufficient"

AnswerSource = Literal["kb", "web", "insufficient"]


# ============================================================
# STRUCTURED-OUTPUT MODELS
# ============================================================


class RouterDecision(BaseModel):
    """NODE 1 — Router Agent output.

    The router understands the employee's question and prepares the retrieval
    query. It always routes to the private HR knowledge-base retrieval (there is
    a single path out of the router — no multi-agent branching).
    """

    next_step: Literal["retrieve_kb"] = Field(
        default="retrieve_kb",
        description=(
            "The next stage in the workflow. The private HR knowledge base is "
            "always attempted first, so this is always 'retrieve_kb'."
        ),
    )
    current_query: str = Field(
        description=(
            "A standalone, keyword-rich retrieval query for the private HR "
            "knowledge base, with conversational references and relative dates "
            "resolved against today's date. Preserve the original intent. Do "
            "not answer the question."
        ),
    )


class EvidenceGrade(BaseModel):
    """Structured grading decision used for BOTH the KB grader (NODE 3) and the
    web grader (NODE 6). Graders decide sufficiency only — they never generate
    the final answer."""

    sufficient: bool = Field(
        description=(
            "True only when the evidence directly and sufficiently addresses the "
            "question without guessing. False when it is unrelated, partial, "
            "ambiguous, about a different topic, or requires information not "
            "present in the evidence."
        )
    )
    reason: str = Field(
        default="",
        description="A one-sentence justification for the sufficiency decision.",
    )
    confidence: float = Field(
        default=0.0,
        description="Confidence in the decision, from 0.0 to 1.0.",
    )


class GroundedAnswer(BaseModel):
    """Structured output of a grounded generation step (NODE 4 / NODE 7).

    `used_chunks` lets the model declare which numbered evidence chunks actually
    contributed, so we only cite sources genuinely used.
    """

    answer: str = Field(description="The grounded answer text for the user.")
    used_chunks: List[int] = Field(
        default_factory=list,
        description=(
            "Zero-based indices of the evidence chunks actually used to produce "
            "the answer. Empty if no chunk contributed."
        ),
    )


# ============================================================
# GRAPH STATE
# ============================================================


class AgentState(TypedDict, total=False):
    """Typed state for the 9-node Agentic RAG workflow. Contains only the fields
    the workflow needs — no speculative extras."""

    # The employee's original, unmodified question.
    original_query: str

    # The query currently being searched (may be rewritten/resolved).
    current_query: str

    # NODE 2 — documents retrieved from Pinecone (relevance in metadata).
    retrieved_documents: List[Document]

    # Formatted KB evidence string handed to the KB grader/generator.
    kb_evidence: str

    # NODE 3 — KB grading decision: {sufficient, reason, confidence}.
    kb_grade: dict

    # NODE 5 — Tavily web search results.
    web_results: List[dict]

    # Formatted web evidence string handed to the web grader/generator.
    web_evidence: str

    # NODE 6 — web grading decision: {sufficient, reason, confidence}.
    web_grade: dict

    # NODE 8 — the rewritten query produced during retry.
    rewritten_query: str

    # Number of query-rewrite retries performed so far.
    retry_count: int

    # Maximum allowed retries (prevents infinite loops).
    max_retries: int

    # Final answer text.
    answer: str

    # Sources/citations returned to the frontend.
    sources: List[dict]

    # Human-readable execution/decision trace.
    execution_trace: List[str]

    # Where the answer came from: "kb" | "web" | "insufficient".
    answer_source: AnswerSource

    # Non-fatal errors captured along the way (e.g. Tavily unavailable).
    errors: List[str]
