from typing import List, Literal

from typing_extensions import TypedDict

from pydantic import BaseModel, Field

from langchain_core.documents import Document


# ============================================================
# INTENTS
# ============================================================

# Canonical intent set for the HR Policy Copilot router. The retrieval source is
# chosen from the semantic intent of the question — never from a keyword match.
INTENT_HR_POLICY = "HR_POLICY"
INTENT_EMPLOYEE = "EMPLOYEE_SPECIFIC"
INTENT_CALENDAR = "COMPANY_CALENDAR"
INTENT_EXTERNAL = "EXTERNAL_GENERAL"
INTENT_ACTION = "ACTION_REQUEST"
INTENT_GENERAL = "GENERAL_CONVERSATION"
INTENT_CLARIFY = "CLARIFICATION_NEEDED"

IntentName = Literal[
    "HR_POLICY",
    "EMPLOYEE_SPECIFIC",
    "COMPANY_CALENDAR",
    "EXTERNAL_GENERAL",
    "ACTION_REQUEST",
    "GENERAL_CONVERSATION",
    "CLARIFICATION_NEEDED",
]

# Intents answered from the internal company knowledge base (Pinecone).
INTERNAL_INTENTS = (
    INTENT_HR_POLICY,
    INTENT_EMPLOYEE,
    INTENT_CALENDAR,
    INTENT_ACTION,
)

# Where an answer actually came from (surfaced to the client + logs).
SOURCE_INTERNAL_KB = "internal_kb"
SOURCE_EMPLOYEE_DATA = "employee_data"
SOURCE_COMPANY_CALENDAR = "company_calendar"
SOURCE_WEB = "web"
SOURCE_NONE = "none"


class IntentDecision(BaseModel):
    """Structured output of the intent-classification step."""

    intent: IntentName = Field(
        description=(
            "Exactly one intent label for the user's message. "
            "HR_POLICY = general company HR policy that applies to everyone. "
            "EMPLOYEE_SPECIFIC = the user's OWN leave balance/usage/approval, or "
            "whether THEY can take leave on/around a date. "
            "COMPANY_CALENDAR = this company's official holidays/closed days. "
            "EXTERNAL_GENERAL = public/general info not specific to this company "
            "(festivals, public/statutory holidays, news, labor law). "
            "ACTION_REQUEST = the user wants the system to perform an action "
            "(apply/submit/create a leave request). "
            "GENERAL_CONVERSATION = greeting/thanks/casual chat. "
            "CLARIFICATION_NEEDED = the question is genuinely ambiguous between "
            "these meanings and context cannot resolve it."
        )
    )
    search_query: str = Field(
        default="",
        description=(
            "A standalone, keyword-rich query for INTERNAL knowledge-base "
            "retrieval, with conversational references and relative dates "
            "resolved against today's date. Do not answer the question. May be "
            "empty for GENERAL_CONVERSATION / CLARIFICATION_NEEDED / "
            "EXTERNAL_GENERAL."
        ),
    )
    clarification: str = Field(
        default="",
        description=(
            "Only when intent is CLARIFICATION_NEEDED: a single short, friendly "
            "question that asks the user to disambiguate (e.g. company holidays "
            "vs leave types vs personal balance). Empty otherwise."
        ),
    )


class EvidenceGrade(BaseModel):
    grade: Literal["good", "weak"] = Field(
        description="Whether the evidence is sufficient and directly relevant to answer the question"
    )


class GroundedAnswer(BaseModel):
    """Structured output of the grounded generation step.

    `used_chunks` lets the model declare which numbered evidence chunks actually
    contributed to the answer, so we only cite sources genuinely used instead of
    listing everything retrieved.
    """

    answer: str = Field(description="The grounded answer text for the user.")
    used_chunks: List[int] = Field(
        default_factory=list,
        description=(
            "Zero-based indices of the evidence chunks actually used to produce "
            "the answer. Empty if no chunk contributed."
        ),
    )


class AgentState(TypedDict, total=False):

    # Original user question
    question: str

    # Query currently being searched (may be rewritten/resolved)
    current_query: str

    # Classified intent (see INTENT_* constants)
    intent: str

    # Where the answer came from (see SOURCE_* constants)
    source_type: str

    # Whether fully answering needs the employee's own data (not yet available)
    requires_employee_data: bool

    # Whether the user asked the system to perform an action (not yet available)
    requires_action: bool

    # Clarifying question to return when intent is CLARIFICATION_NEEDED
    clarification: str

    # Current date (ISO) supplied by the backend for date interpretation
    today: str

    # Bounded prior conversation turns: [{ "role", "content" }]
    history: List[dict]

    # Retrieved Pinecone documents (relevance stored in metadata)
    kb_docs: List[Document]

    # Tavily search results
    web_results: List[dict]

    # KB evidence grade
    kb_grade: str

    # Web evidence grade
    web_grade: str

    # Final answer
    answer: str

    # Where the answer came from (legacy slug, kept for message persistence)
    source_used: str

    # Number of query rewrites
    retry_count: int

    # Debugging / execution trace
    trace: List[str]

    # Sources returned to frontend
    citations: List[dict]
