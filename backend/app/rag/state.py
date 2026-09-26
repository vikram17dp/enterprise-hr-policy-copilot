"""LangGraph state + structured-output models for the HR Policy Copilot.

The workflow is a fixed 9-stage Agentic RAG graph:

    Router -> Retrieve (Pinecone) -> Grade KB (per requirement)
        -> [all supported]        Generate KB Answer -> Final Answer
        -> [partially supported]  Generate KB Answer -> Tavily (missing public
                                  requirements only) -> Grade Web
                                      -> [supported]  Generate Web Answer
                                      -> [missing]    Query Rewrite & Retry
        -> [all missing/public]   Tavily -> Grade Web -> ...
        -> [all missing/internal] Query Rewrite & Retry -> back to Retrieve

Grading is REQUIREMENT-LEVEL, not whole-question binary: a mixed question
(company policy + public/current info) is decomposed into requirements, each
graded independently, so the internal KB answer is never discarded just because
a public requirement is missing, and public web results never override company
policy.

The state carries ONLY what these stages need. No extra fields.
"""

from typing import List, Literal

from typing_extensions import TypedDict

from pydantic import BaseModel, Field

from langchain_core.documents import Document


# ============================================================
# ANSWER SOURCE
# ============================================================

# Where the final answer came from (surfaced to the client + logs). A mixed
# question resolved from both sources reports "INTERNAL_KB + WEB".
ANSWER_SOURCE_KB = "INTERNAL_KB"
ANSWER_SOURCE_WEB = "WEB"
ANSWER_SOURCE_KB_WEB = "INTERNAL_KB + WEB"
ANSWER_SOURCE_INSUFFICIENT = "insufficient"

AnswerSource = Literal[
    "INTERNAL_KB",
    "WEB",
    "INTERNAL_KB + WEB",
    "insufficient",
]


# ============================================================
# REQUIREMENT SOURCES
# ============================================================

# Where a single information requirement must be answered from.
SOURCE_INTERNAL_KB = "INTERNAL_KB"
SOURCE_WEB = "WEB"

RequirementSource = Literal["INTERNAL_KB", "WEB"]


# ============================================================
# STRUCTURED-OUTPUT MODELS
# ============================================================


class Requirement(BaseModel):
    """A single information requirement decomposed from the user's question.

    A mixed question produces multiple requirements, each tagged with the source
    that must answer it. Company-specific information is always INTERNAL_KB;
    current/public/statutory information is WEB.
    """

    id: str = Field(
        description="A short snake_case identifier for this requirement.",
    )
    topic: str = Field(
        description=(
            "A concise, self-contained statement of exactly what information "
            "this requirement needs. Relative dates ('recent', 'next month') "
            "are resolved against today's date."
        ),
    )
    source: RequirementSource = Field(
        description=(
            "INTERNAL_KB for company-specific HR policy/holidays/leave/procedures "
            "(and private employee data). WEB for current government/statutory "
            "or other public/external information."
        ),
    )


class RouterDecision(BaseModel):
    """NODE 1 — Router Agent output.

    The router identifies intent and decomposes the question into information
    requirements. It does NOT answer and does NOT rewrite the user's intent. It
    always routes to the private HR knowledge-base retrieval first (there is a
    single path out of the router — no multi-agent branching).
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
            "knowledge base, built from the INTERNAL_KB requirements (or the "
            "whole question when there are none), with conversational references "
            "and relative dates resolved against today's date. Preserve the "
            "original intent. Do not answer the question."
        ),
    )
    requirements: List[Requirement] = Field(
        default_factory=list,
        description=(
            "The information requirements the question decomposes into. A simple "
            "single-topic question yields exactly one requirement; a mixed "
            "question yields one per distinct information need."
        ),
    )


class RequirementGrade(BaseModel):
    """Per-requirement grading decision (used by BOTH the KB and web graders)."""

    id: str = Field(description="The requirement id being graded.")
    topic: str = Field(default="", description="The requirement topic.")
    source_required: RequirementSource = Field(
        default=SOURCE_INTERNAL_KB,
        description="The source this requirement must be answered from.",
    )
    status: Literal["supported", "partially_supported", "missing"] = Field(
        description=(
            "supported: the evidence fully answers this specific requirement. "
            "partially_supported: the evidence answers part of it. "
            "missing: the evidence does not contain this information."
        ),
    )
    evidence: str = Field(
        default="",
        description="A one-sentence justification quoting/summarizing the evidence.",
    )


class KBGrade(BaseModel):
    """NODE 3 — requirement-level grading of the retrieved internal KB evidence."""

    overall_status: Literal["sufficient", "partial", "insufficient"] = Field(
        description=(
            "sufficient: every requirement is supported by the internal KB. "
            "partial: some requirements are supported and some are missing. "
            "insufficient: no requirement is supported by the internal KB."
        ),
    )
    requirements: List[RequirementGrade] = Field(
        default_factory=list,
        description="The per-requirement grading decisions.",
    )
    requires_web: bool = Field(
        default=False,
        description=(
            "True when at least one missing/partially_supported requirement is "
            "public/current information that must be answered from the WEB."
        ),
    )
    confidence: float = Field(
        default=0.0,
        description="Confidence in the grading, from 0.0 to 1.0.",
    )


class WebGrade(BaseModel):
    """NODE 6 — requirement-level grading of the Tavily web evidence, applied
    ONLY to the requirements that were missing from the internal KB."""

    overall_status: Literal["sufficient", "partial", "insufficient"] = Field(
        description=(
            "sufficient: every web-targeted missing requirement is now supported. "
            "partial: some are supported and some remain missing. "
            "insufficient: none are supported by the web evidence."
        ),
    )
    requirements: List[RequirementGrade] = Field(
        default_factory=list,
        description="The per-requirement grading decisions for the missing requirements.",
    )
    confidence: float = Field(
        default=0.0,
        description="Confidence in the grading, from 0.0 to 1.0.",
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

    # The query currently being searched in the KB (may be resolved/rewritten).
    current_query: str

    # NODE 1 — the decomposed information requirements:
    # [{id, topic, source: "INTERNAL_KB"|"WEB"}].
    requirements: List[dict]

    # NODE 2 — documents retrieved from Pinecone (relevance in metadata).
    retrieved_documents: List[Document]

    # Formatted KB evidence string handed to the KB grader/generator.
    kb_evidence: str

    # NODE 3 — requirement-level KB grading decision:
    # {overall_status, requirements, supported_requirements,
    #  missing_requirements, requires_web, confidence}.
    kb_grade: dict

    # Requirements supported by the internal KB: [{id, topic, source}].
    supported_requirements: List[dict]

    # Running list of still-unresolved requirements: [{id, topic, source}].
    # Populated by the KB grader and shrunk by the web grader.
    missing_requirements: List[dict]

    # Targeted Tavily query built from the missing WEB requirements only.
    web_query: str

    # NODE 5 — Tavily web search results.
    web_results: List[dict]

    # Formatted web evidence string handed to the web grader/generator.
    web_evidence: str

    # NODE 6 — requirement-level web grading decision:
    # {overall_status, requirements, confidence}.
    web_grade: dict

    # Requirement topics the KB generator should answer (supported ones).
    kb_answer_requirements: List[str]

    # Requirement topics the web generator should answer (resolved from web).
    web_answer_requirements: List[str]

    # NODE 4 — answer generated from the internal KB (supported requirements).
    kb_answer: str

    # NODE 4 — sources for the KB answer.
    kb_sources: List[dict]

    # NODE 7 — answer generated from the web (missing public requirements).
    web_answer: str

    # NODE 7 — sources for the web answer.
    web_sources: List[dict]

    # NODE 8 — the rewritten query produced during retry.
    rewritten_query: str

    # Number of query-rewrite retries performed so far.
    retry_count: int

    # Maximum allowed retries (prevents infinite loops).
    max_retries: int

    # NODE 9 — final merged answer text.
    answer: str

    # NODE 9 — combined sources/citations returned to the frontend.
    sources: List[dict]

    # Human-readable execution/decision trace.
    execution_trace: List[str]

    # Where the answer came from:
    # "INTERNAL_KB" | "WEB" | "INTERNAL_KB + WEB" | "insufficient".
    answer_source: AnswerSource

    # Non-fatal errors captured along the way (e.g. Tavily unavailable).
    errors: List[str]
