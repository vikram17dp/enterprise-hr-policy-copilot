from typing import List, Literal

from typing_extensions import TypedDict

from pydantic import BaseModel, Field

from langchain_core.documents import Document


class RouteDecision(BaseModel):
    route: Literal["kb", "direct"] = Field(
        description="kb for HR/policy questions; direct for greetings/simple chat"
    )


class EvidenceGrade(BaseModel):
    grade: Literal["good", "weak"] = Field(
        description="Whether the evidence is sufficient and directly relevant to answer the question"
    )


class AgentState(TypedDict):

    # Original user question
    question: str

    # Query currently being searched
    current_query: str

    # Retrieved Pinecone documents
    kb_docs: List[Document]

    # Tavily search results
    web_results: List[dict]

    # KB evidence grade
    kb_grade: str

    # Web evidence grade
    web_grade: str

    # Final answer
    answer: str

    # Where the answer came from
    source_used: str

    # Number of query rewrites
    retry_count: int

    # Debugging / execution trace
    trace: List[str]

    # Sources returned to frontend
    citations: List[dict]