import logging
from typing import Literal

from langchain_groq import ChatGroq
from langchain_tavily import TavilySearch
from langgraph.graph import StateGraph, START, END

from app.core.config import get_settings
from app.rag.state import (
    AgentState,
    RouteDecision,
    EvidenceGrade,
)
from app.rag.retriever import get_retriever


logger = logging.getLogger(__name__)

settings = get_settings()


_llm = None
_web_search = None


# ============================================================
# LLM
# ============================================================


def llm():
    global _llm

    if _llm is None:

        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is missing")

        _llm = ChatGroq(
            model=settings.groq_model,
            temperature=0,
            api_key=settings.groq_api_key,
        )

    return _llm


# ============================================================
# TAVILY
# ============================================================


def web_search_tool():
    global _web_search

    if _web_search is None:

        if not settings.tavily_api_key:
            raise RuntimeError("TAVILY_API_KEY is missing")

        _web_search = TavilySearch(
            tavily_api_key=settings.tavily_api_key,
            max_results=5,
            topic="general",
            include_answer=True,
            include_raw_content=False,
        )

    return _web_search


# ============================================================
# TRACE
# ============================================================


def add_trace(state: AgentState, message: str):
    return [
        *state.get("trace", []),
        message,
    ]


# ============================================================
# ROUTER
# ============================================================

def route_question(state: AgentState):

    question = state["question"]

    router = llm().with_structured_output(
        RouteDecision,
        method="json_mode",
    )

    decision = router.invoke(
        f"""
You are the routing component of an enterprise HR
policy assistant.

Classify the user's question into exactly one route.

"kb":
Use this for:
- company HR policies
- employee benefits
- leave
- payroll
- attendance
- onboarding
- offboarding
- company procedures
- company rules
- HR operations
- employment questions that may be answered by the
  company's internal knowledge base

"direct":
Use this only for:
- greetings
- thanks
- casual conversation
- simple non-HR conversation

Important:

Questions about HR, employment, leave, salary, benefits,
company policies, or workplace rules MUST go to "kb"
first.

Do NOT route an HR question directly to web search.

User question:
{question}

Return ONLY valid JSON:

{{"route": "kb"}}

or

{{"route": "direct"}}
"""
    )

    logger.info(
        "Question route: %s",
        decision.route,
    )

    return {
        "source_used": decision.route,
        "trace": add_trace(
            state,
            f"Question routing → {decision.route.upper()}",
        ),
    }


# ============================================================
# ROUTER CONDITION
# ============================================================


def route_after_router(
    state: AgentState,
) -> Literal["retrieve_kb", "direct_answer"]:

    if state["source_used"] == "kb":
        return "retrieve_kb"

    return "direct_answer"


# ============================================================
# PINECONE RETRIEVAL
# ============================================================


def retrieve_kb(state: AgentState):

    question = state["current_query"]

    logger.info(
        "Retrieving from Pinecone: %s",
        question,
    )

    retriever = get_retriever()

    documents = retriever.invoke(question)

    logger.info(
        "Pinecone returned %d documents",
        len(documents),
    )

    return {
        "kb_docs": documents,
        "trace": add_trace(
            state,
            f"Pinecone retrieval → {len(documents)} documents",
        ),
    }


# ============================================================
# FORMAT KB DOCUMENTS
# ============================================================


def format_kb_documents(documents) -> str:

    if not documents:
        return "No company knowledge base evidence was found."

    formatted = []

    for index, doc in enumerate(documents, start=1):

        source = doc.metadata.get(
            "source",
            "Unknown source",
        )

        start_index = doc.metadata.get(
            "start_index",
            "",
        )

        formatted.append(
            f"""
--- Company KB Document {index} ---

Source:
{source}

Start Index:
{start_index}

Content:
{doc.page_content}
""".strip()
        )

    return "\n\n".join(formatted)


# ============================================================
# GRADE KB EVIDENCE
# ============================================================


def grade_kb(state: AgentState):

    evidence = format_kb_documents(
        state["kb_docs"]
    )

    grader = llm().with_structured_output(
        EvidenceGrade,
        method="json_mode",
    )

    grade = grader.invoke(
        f"""
You are an evidence evaluator for an enterprise HR
policy and employee support assistant.

The company knowledge base is the PRIMARY source of truth
for company-specific HR questions.

User question:
{state["question"]}

Company knowledge base evidence:
{evidence}

Evaluate whether the company knowledge base contains
enough relevant information to answer the user's question.

Return "good" ONLY when:

1. The evidence directly addresses the user's question.
2. The evidence contains enough information to answer it.
3. The answer can be produced without guessing.
4. The evidence is clearly applicable to the question.

Return "weak" when:

1. The evidence is unrelated.
2. The evidence only partially answers the question.
3. The evidence is ambiguous.
4. The answer would require information not present
   in the company knowledge base.
5. The retrieved chunks are about a different policy/topic.

For example:

Question:
"How many annual leave days are employees entitled to?"

Evidence:
"Full-time employees receive 20 days of paid annual leave
per calendar year."

Result:
{{"grade": "good"}}

If the evidence does not contain the answer:

{{"grade": "weak"}}

Return ONLY valid JSON.
"""
    )

    logger.info(
        "KB evidence grade: %s",
        grade.grade,
    )

    return {
        "kb_grade": grade.grade,
        "trace": add_trace(
            state,
            f"KB evidence grade → {grade.grade.upper()}",
        ),
    }


# ============================================================
# AFTER KB GRADING
# ============================================================


def after_kb(
    state: AgentState,
) -> Literal[
    "generate_from_kb",
    "search_web",
]:

    if state["kb_grade"] == "good":
        return "generate_from_kb"

    return "search_web"


# ============================================================
# GENERATE ANSWER FROM COMPANY KB
# ============================================================


def generate_from_kb(state: AgentState):

    evidence = format_kb_documents(
        state["kb_docs"]
    )

    answer = llm().invoke(
        f"""
You are an enterprise HR policy and employee support
copilot.

The following information comes ONLY from the company's
private HR knowledge base.

Answer the user's question ONLY using this evidence.

Important rules:

1. Do not invent information.
2. Do not use outside knowledge.
3. Do not use web knowledge.
4. If the evidence contains the answer, state it clearly.
5. If the evidence contains limitations or conditions,
   mention them.
6. If the evidence does not fully answer the question,
   do not guess.
7. Keep the answer concise and practical.
8. Treat the company knowledge base as the source of truth
   for company-specific HR policy questions.

User question:
{state["question"]}

Company HR knowledge base:
{evidence}
"""
    ).content.strip()

    citations = []

    seen_sources = set()

    for doc in state["kb_docs"]:

        source = doc.metadata.get("source")

        if not source:
            continue

        if source in seen_sources:
            continue

        seen_sources.add(source)

        citations.append(
            {
                "title": source,
                "url": "",
                "type": "company_knowledge_base",
            }
        )

    return {
        "answer": answer,
        "source_used": "company_knowledge_base",
        "citations": citations,
        "trace": add_trace(
            state,
            "Answer generation → COMPANY KNOWLEDGE BASE",
        ),
    }


# ============================================================
# DIRECT ANSWER
# ============================================================


def direct_answer(state: AgentState):

    answer = llm().invoke(
        f"""
You are a friendly enterprise HR assistant.

The user sent a simple conversational message.

Respond naturally and briefly.

Do not search the web.
Do not retrieve company documents.

User:
{state["question"]}
"""
    ).content.strip()

    return {
        "answer": answer,
        "source_used": "direct",
        "citations": [],
        "trace": add_trace(
            state,
            "Direct response → SIMPLE CONVERSATION",
        ),
    }


# ============================================================
# WEB SEARCH
# ============================================================


def search_web(state: AgentState):

    query = state["current_query"]

    logger.info(
        "Searching Tavily: %s",
        query,
    )

    result = web_search_tool().invoke(
        {
            "query": query,
        }
    )

    web_results = []
    citations = []

    # --------------------------------------------------------
    # Tavily dictionary response
    # --------------------------------------------------------

    if isinstance(result, dict):

        search_answer = result.get("answer")

        if search_answer:

            web_results.append(
                {
                    "type": "search_answer",
                    "title": "Tavily Search Answer",
                    "url": "",
                    "content": search_answer,
                }
            )

        for item in result.get("results", []):

            title = item.get(
                "title",
                "",
            )

            url = item.get(
                "url",
                "",
            )

            content = item.get(
                "content",
                "",
            )

            web_results.append(
                {
                    "type": "search_result",
                    "title": title,
                    "url": url,
                    "content": content,
                }
            )

            if url:

                citations.append(
                    {
                        "title": title or url,
                        "url": url,
                        "type": "web",
                    }
                )

    # --------------------------------------------------------
    # Unexpected response
    # --------------------------------------------------------

    else:

        web_results.append(
            {
                "type": "raw",
                "title": "Web Search Result",
                "url": "",
                "content": str(result),
            }
        )

    logger.info(
        "Tavily returned %d results",
        len(web_results),
    )

    return {
        "web_results": web_results,
        "citations": citations,
        "source_used": "web_search",
        "trace": add_trace(
            state,
            f"Tavily search → {len(web_results)} results",
        ),
    }


# ============================================================
# FORMAT WEB RESULTS
# ============================================================


def format_web_results(
    web_results: list[dict],
) -> str:

    if not web_results:
        return "No web evidence was found."

    formatted = []

    for index, item in enumerate(
        web_results,
        start=1,
    ):

        title = item.get(
            "title",
            "",
        )

        url = item.get(
            "url",
            "",
        )

        content = item.get(
            "content",
            "",
        )

        formatted.append(
            f"""
--- Web Result {index} ---

Title:
{title}

URL:
{url}

Content:
{content}
""".strip()
        )

    return "\n\n".join(formatted)


# ============================================================
# GRADE WEB EVIDENCE
# ============================================================


def grade_web(state: AgentState):

    evidence = format_web_results(
        state["web_results"]
    )

    grader = llm().with_structured_output(
        EvidenceGrade,
        method="json_mode",
    )

    grade = grader.invoke(
        f"""
You are an evidence evaluator for an enterprise HR
policy and employee support assistant.

The private company knowledge base did not contain enough
evidence to answer the question.

Now evaluate the external web evidence.

User question:
{state["question"]}

Current search query:
{state["current_query"]}

Web evidence:
{evidence}

Return "good" ONLY when:

1. The evidence directly relates to the question.
2. It contains enough information to answer the question.
3. The information is reasonably reliable.
4. The answer does not require unsupported assumptions.

Return "weak" when:

1. Results are unrelated.
2. Results do not contain enough information.
3. Evidence is ambiguous.
4. Sources are too poor to support a reliable answer.

Return ONLY valid JSON:

{{"grade": "good"}}

or

{{"grade": "weak"}}
"""
    )

    logger.info(
        "Web evidence grade: %s",
        grade.grade,
    )

    return {
        "web_grade": grade.grade,
        "trace": add_trace(
            state,
            f"Web evidence grade → {grade.grade.upper()}",
        ),
    }


# ============================================================
# AFTER WEB GRADING
# ============================================================


def after_web(
    state: AgentState,
) -> Literal[
    "generate_from_web",
    "rewrite_query",
    "insufficient",
]:

    if state["web_grade"] == "good":
        return "generate_from_web"

    if state["retry_count"] < settings.max_retries:
        return "rewrite_query"

    return "insufficient"


# ============================================================
# REWRITE SEARCH QUERY
# ============================================================


def rewrite_query(state: AgentState):

    rewritten = llm().invoke(
        f"""
Rewrite the following user question into a better
public web search query.

Rules:

- Preserve the original intent.
- Make the query specific.
- Add useful keywords.
- Include country/jurisdiction when relevant.
- Do not answer the question.
- Return ONLY the rewritten query.
- Do not add quotation marks.
- Do not explain anything.

Original question:
{state["question"]}

Previous search query:
{state["current_query"]}
"""
    ).content.strip()

    new_retry_count = (
        state["retry_count"] + 1
    )

    logger.info(
        "Query rewrite %d: %s",
        new_retry_count,
        rewritten,
    )

    return {
        "current_query": rewritten,
        "retry_count": new_retry_count,
        "trace": add_trace(
            state,
            f"Query rewrite → {rewritten}",
        ),
    }


# ============================================================
# GENERATE ANSWER FROM WEB
# ============================================================


def generate_from_web(state: AgentState):

    evidence = format_web_results(
        state["web_results"]
    )

    answer = llm().invoke(
        f"""
You are an enterprise HR policy and employee support
copilot.

The private company knowledge base did not contain enough
information to answer this question.

The following information comes from external public
web sources.

Answer ONLY using the provided web evidence.

Important rules:

1. Do not invent facts.
2. Do not use information outside the evidence.
3. If sources conflict, clearly mention the conflict.
4. Clearly state that the information comes from public
   external sources.
5. Never present public information as company policy.
6. If this is a company-specific policy question, say that
   the company's HR team should validate it.
7. Keep the answer concise and practical.

User question:
{state["question"]}

External web evidence:
{evidence}
"""
    ).content.strip()

    return {
        "answer": answer,
        "source_used": "web_search",
        "citations": state.get(
            "citations",
            [],
        ),
        "trace": add_trace(
            state,
            "Answer generation → WEB SEARCH",
        ),
    }


# ============================================================
# INSUFFICIENT EVIDENCE
# ============================================================


def insufficient(state: AgentState):

    return {
        "answer": (
            "I couldn't find enough reliable information "
            "from the available sources to answer this "
            "confidently."
        ),
        "source_used": "insufficient_evidence",
        "citations": state.get(
            "citations",
            [],
        ),
        "trace": add_trace(
            state,
            "Stopped → insufficient evidence",
        ),
    }


# ============================================================
# BUILD GRAPH
# ============================================================


def build_graph():

    graph = StateGraph(AgentState)

    # --------------------------------------------------------
    # Nodes
    # --------------------------------------------------------

    graph.add_node(
        "route_question",
        route_question,
    )

    graph.add_node(
        "retrieve_kb",
        retrieve_kb,
    )

    graph.add_node(
        "grade_kb",
        grade_kb,
    )

    graph.add_node(
        "generate_from_kb",
        generate_from_kb,
    )

    graph.add_node(
        "search_web",
        search_web,
    )

    graph.add_node(
        "grade_web",
        grade_web,
    )

    graph.add_node(
        "rewrite_query",
        rewrite_query,
    )

    graph.add_node(
        "generate_from_web",
        generate_from_web,
    )

    graph.add_node(
        "direct_answer",
        direct_answer,
    )

    graph.add_node(
        "insufficient",
        insufficient,
    )

    # --------------------------------------------------------
    # START
    # --------------------------------------------------------

    graph.add_edge(
        START,
        "route_question",
    )

    # --------------------------------------------------------
    # ROUTER
    # --------------------------------------------------------

    graph.add_conditional_edges(
        "route_question",
        route_after_router,
        {
            "retrieve_kb": "retrieve_kb",
            "direct_answer": "direct_answer",
        },
    )

    # --------------------------------------------------------
    # PINECONE
    # --------------------------------------------------------

    graph.add_edge(
        "retrieve_kb",
        "grade_kb",
    )

    graph.add_conditional_edges(
        "grade_kb",
        after_kb,
        {
            "generate_from_kb": "generate_from_kb",
            "search_web": "search_web",
        },
    )

    graph.add_edge(
        "generate_from_kb",
        END,
    )

    # --------------------------------------------------------
    # WEB FALLBACK
    # --------------------------------------------------------

    graph.add_edge(
        "search_web",
        "grade_web",
    )

    graph.add_conditional_edges(
        "grade_web",
        after_web,
        {
            "generate_from_web": "generate_from_web",
            "rewrite_query": "rewrite_query",
            "insufficient": "insufficient",
        },
    )

    graph.add_edge(
        "rewrite_query",
        "search_web",
    )

    graph.add_edge(
        "generate_from_web",
        END,
    )

    graph.add_edge(
        "insufficient",
        END,
    )

    graph.add_edge(
        "direct_answer",
        END,
    )

    return graph.compile()


# ============================================================
# COMPILE GRAPH
# ============================================================


agent_graph = build_graph()


# ============================================================
# ASK
# ============================================================


def ask(question: str):

    question = question.strip()

    if not question:
        raise ValueError(
            "Question cannot be empty."
        )

    initial: AgentState = {

        "question": question,

        "current_query": question,

        "kb_docs": [],

        "web_results": [],

        "kb_grade": "",

        "web_grade": "",

        "answer": "",

        "source_used": "",

        "retry_count": 0,

        "trace": [],

        "citations": [],
    }

    return agent_graph.invoke(
        initial
    )