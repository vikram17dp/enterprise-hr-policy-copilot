"""LangGraph Agentic RAG workflow for the HR Policy Copilot.

EXACTLY nine logical stages, wired with conditional edges:

    NODE 1  router                (LLM)   understand + route to KB retrieval
    NODE 2  retrieve_pinecone             semantic search over private HR KB
    NODE 3  grade_kb_evidence     (LLM)   {sufficient, reason, confidence}
    NODE 4  generate_kb_answer    (LLM)   answer from KB only
    NODE 5  web_search_tavily             FALLBACK web search (KB insufficient)
    NODE 6  grade_web_evidence    (LLM)   {sufficient, reason, confidence}
    NODE 7  generate_web_answer   (LLM)   answer from web only
    NODE 8  rewrite_query_retry   (LLM)   rewrite + retry (bounded)
    NODE 9  final_answer                  assemble answer + sources + trace

Flow:
    START -> router -> retrieve_pinecone -> grade_kb_evidence
        sufficient?  yes -> generate_kb_answer ----------------> final_answer
                     no  -> web_search_tavily -> grade_web_evidence
        sufficient?  yes -> generate_web_answer ---------------> final_answer
                     no  -> rewrite_query_retry
                              retries left? yes -> retrieve_pinecone
                                            no  -> final_answer (insufficient)
    final_answer -> END

The private HR knowledge base is ALWAYS attempted before Tavily. Tavily is a
fallback only. No extra agents, nodes, or branches beyond the nine above.
"""

import logging
import os
from datetime import date
from typing import Literal
from urllib.parse import urlparse

from langchain_groq import ChatGroq
from langchain_tavily import TavilySearch
from langgraph.graph import StateGraph, START, END

from app.core.config import get_settings
from app.rag.state import (
    AgentState,
    RouterDecision,
    EvidenceGrade,
    GroundedAnswer,
    ANSWER_SOURCE_KB,
    ANSWER_SOURCE_WEB,
    ANSWER_SOURCE_INSUFFICIENT,
)
from app.rag.vectorstore import get_vectorstore


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
# HELPERS
# ============================================================


def _trace(state: AgentState, message: str) -> list[str]:
    return [*state.get("execution_trace", []), message]


def _errors(state: AgentState, message: str) -> list[str]:
    return [*state.get("errors", []), message]


def _doc_name(doc) -> str:
    source = doc.metadata.get("source") or "unknown"
    return os.path.basename(str(source))


def _chunk_id(doc) -> str:
    name = _doc_name(doc)
    start = doc.metadata.get("start_index")
    try:
        start = int(start)
    except (TypeError, ValueError):
        return name
    return f"{name}#{start}"


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:  # noqa: BLE001
        return ""


def _format_kb_documents(documents) -> str:
    if not documents:
        return "No company knowledge base evidence was found."
    parts = []
    for i, doc in enumerate(documents):
        parts.append(f"[{i}] Source: {_doc_name(doc)}\n{doc.page_content}")
    return "\n\n".join(parts)


def _format_web_results(web_results: list[dict]) -> str:
    if not web_results:
        return "No web evidence was found."
    formatted = []
    for index, item in enumerate(web_results, start=1):
        formatted.append(
            f"""
--- Web Result {index} ---

Title:
{item.get("title", "")}

URL:
{item.get("url", "")}

Content:
{item.get("content", "")}
""".strip()
        )
    return "\n\n".join(formatted)


def _select_kb_sources(docs, used_indices, force_fallback: bool) -> list[dict]:
    """Project the KB chunks actually used into frontend-ready source dicts."""
    indices = [
        i
        for i in (used_indices or [])
        if isinstance(i, int) and 0 <= i < len(docs)
    ]

    if not indices and force_fallback and docs:
        indices = [0]  # docs already sorted by relevance (desc)

    sources = []
    seen = set()
    for i in indices:
        doc = docs[i]
        cid = _chunk_id(doc)
        if cid in seen:
            continue
        seen.add(cid)
        score = round(float(doc.metadata.get("relevance_score", 0.0)), 4)
        sources.append(
            {
                "type": "company_knowledge_base",
                "title": _doc_name(doc),
                "url": "",
                "document": _doc_name(doc),
                "chunk_id": cid,
                "relevance_score": score,
                "score": score,
            }
        )
    return sources


def _web_sources(web_results: list[dict]) -> list[dict]:
    """Project Tavily results into frontend-ready web source dicts."""
    sources = []
    seen = set()
    for item in web_results or []:
        url = item.get("url") or ""
        if not url or url in seen:
            continue
        seen.add(url)
        title = item.get("title") or url
        sources.append(
            {
                "type": "web",
                "title": title,
                "url": url,
                "domain": _domain(url),
            }
        )
    return sources


# ============================================================
# NODE 1 — ROUTER AGENT
# ============================================================


def router(state: AgentState):
    """Understand the employee's question and prepare the retrieval query.

    This is a single router, not a multi-agent system. It always routes to the
    private HR knowledge-base retrieval — the KB is attempted before any web
    search.
    """

    question = state["original_query"]
    today = date.today().isoformat()

    try:
        decision = llm().with_structured_output(
            RouterDecision,
            method="json_mode",
        ).invoke(
            f"""
You are the Router Agent of an INTERNAL enterprise HR Policy Copilot for one
specific company ("PeoplePrime Technologies").

Today's date: {today}

Your ONLY job here is to understand the employee's question and produce a clean,
standalone retrieval query for the company's PRIVATE HR knowledge base. The
private knowledge base is ALWAYS searched first; do not decide to skip it.

Rules for current_query:
- Preserve the original intent exactly.
- Resolve pronouns and relative dates (e.g. "next week", "next month") against
  today's date.
- Make it keyword-rich and self-contained for semantic retrieval.
- Do NOT answer the question. Do NOT add outside facts.

Return ONLY valid JSON:
{{"next_step": "retrieve_kb", "current_query": "<retrieval query>"}}

Employee question:
{question}
"""
        )
        current_query = (decision.current_query or "").strip() or question
    except Exception as exc:  # noqa: BLE001 - router failure is non-fatal
        logger.exception("Router failed; falling back to the raw question")
        current_query = question
        return {
            "current_query": current_query,
            "errors": _errors(state, f"router: {exc}"),
            "execution_trace": _trace(state, "Router Agent (fallback: raw query)"),
        }

    logger.info("QUERY: %s | ROUTER query=%r", question, current_query)

    return {
        "current_query": current_query,
        "execution_trace": _trace(state, "Router Agent"),
    }


# ============================================================
# NODE 2 — RETRIEVE FROM PINECONE
# ============================================================


def retrieve_pinecone(state: AgentState):
    """Semantic search against the private HR knowledge base (Pinecone).

    Preserves content, document name, metadata, relevance score, and source for
    citations. Pinecone/embedding failures are fatal (propagate) so the API can
    return a controlled 503 rather than silently fabricating an answer.
    """

    query = state.get("current_query") or state["original_query"]

    logger.info("RETRIEVAL (Pinecone): %s", query)

    vectorstore = get_vectorstore()

    scored = vectorstore.similarity_search_with_relevance_scores(
        query,
        k=settings.top_k,
    )

    documents = []
    for doc, score in scored:
        if score is None:
            continue
        if score < settings.retrieval_score_threshold:
            logger.info(
                "Dropping low-relevance chunk %s (%.4f < %.2f)",
                _chunk_id(doc),
                score,
                settings.retrieval_score_threshold,
            )
            continue
        doc.metadata["relevance_score"] = float(score)
        documents.append(doc)

    logger.info(
        "Pinecone returned %d documents (kept %d above %.2f): %s",
        len(scored),
        len(documents),
        settings.retrieval_score_threshold,
        [
            f"{_chunk_id(d)}={d.metadata.get('relevance_score', 0):.4f}"
            for d in documents
        ],
    )

    retry = state.get("retry_count", 0)
    label = "Pinecone Retrieval" if retry == 0 else f"Pinecone Retrieval (retry {retry})"

    return {
        "retrieved_documents": documents,
        "kb_evidence": _format_kb_documents(documents),
        "execution_trace": _trace(
            state,
            f"{label} → {len(documents)} documents",
        ),
    }


# ============================================================
# NODE 3 — GRADE KB EVIDENCE
# ============================================================


def grade_kb_evidence(state: AgentState):
    """Decide whether the retrieved KB context is sufficient. Never generates the
    answer. A malformed grader response is treated as insufficient."""

    question = state["original_query"]
    evidence = state.get("kb_evidence") or _format_kb_documents(
        state.get("retrieved_documents", [])
    )

    try:
        grade = llm().with_structured_output(
            EvidenceGrade,
            method="json_mode",
        ).invoke(
            f"""
You are an evidence evaluator for an enterprise HR assistant. The private
company knowledge base is the PRIMARY source of truth for company-specific
questions.

User question:
{question}

Company knowledge base evidence:
{evidence}

Decide whether the evidence is sufficient to answer the question directly and
without guessing.

Return ONLY valid JSON:
{{"sufficient": true|false, "reason": "<one sentence>", "confidence": <0.0-1.0>}}
"""
        )
        kb_grade = {
            "sufficient": bool(grade.sufficient),
            "reason": grade.reason or "",
            "confidence": float(grade.confidence or 0.0),
        }
    except Exception as exc:  # noqa: BLE001 - malformed grader response
        logger.exception("KB grader failed; treating evidence as insufficient")
        kb_grade = {
            "sufficient": False,
            "reason": f"grader error: {exc}",
            "confidence": 0.0,
        }
        return {
            "kb_grade": kb_grade,
            "kb_evidence": evidence,
            "errors": _errors(state, f"grade_kb_evidence: {exc}"),
            "execution_trace": _trace(state, "KB Evidence Grading: error → insufficient"),
        }

    logger.info(
        "KB evidence grade: sufficient=%s confidence=%.2f reason=%s",
        kb_grade["sufficient"],
        kb_grade["confidence"],
        kb_grade["reason"],
    )

    return {
        "kb_grade": kb_grade,
        "kb_evidence": evidence,
        "execution_trace": _trace(
            state,
            "KB Evidence Grading: sufficient"
            if kb_grade["sufficient"]
            else "KB Evidence Grading: insufficient",
        ),
    }


def after_kb(state: AgentState) -> Literal["generate_kb_answer", "web_search_tavily"]:
    """KB sufficient -> generate from KB; otherwise fall back to Tavily."""
    if state.get("kb_grade", {}).get("sufficient"):
        return "generate_kb_answer"
    return "web_search_tavily"


# ============================================================
# NODE 4 — GENERATE ANSWER FROM KB
# ============================================================


def generate_kb_answer(state: AgentState):
    """Generate the answer using ONLY the retrieved private KB evidence."""

    docs = state.get("retrieved_documents", [])
    evidence = state.get("kb_evidence") or _format_kb_documents(docs)
    today = date.today().isoformat()

    grounded = llm().with_structured_output(
        GroundedAnswer,
        method="json_mode",
    ).invoke(
        f"""
You are an INTERNAL HR Policy Copilot for one specific company.

Answer using ONLY the retrieved internal HR knowledge-base evidence below.

Rules:
1. Do not hallucinate and do not introduce unsupported HR policies.
2. Prefer the company's private HR documents.
3. If the retrieved context does not contain the answer, clearly say the HR
   knowledge base does not currently contain that information.
4. Never invent leave balances, approvals, or employee-specific records. If the
   question needs the employee's own data (balance/usage/approval) and it is not
   in the evidence, state the relevant COMPANY POLICY for context and clearly
   explain you cannot verify their personal availability — direct them to the HR
   portal / HR team. Never claim leave is approved or available.
5. Keep the answer directly related to the employee's question.
6. Write clean natural language. Do NOT mention chunk numbers, indices, "[0]",
   "see chunk", or any internal retrieval/debugging detail. "used_chunks" is
   metadata only.

Today's date: {today}

RETRIEVED INTERNAL HR EVIDENCE (chunks are numbered):
{evidence}

User question:
{state["original_query"]}

Respond with JSON only:
{{"answer": "<concise answer for the employee>", "used_chunks": [<indices actually used>]}}

Set "used_chunks" to [] if no chunk genuinely contributed.
"""
    )

    answer = (grounded.answer or "").strip()
    used = grounded.used_chunks or []
    sources = _select_kb_sources(docs, used, force_fallback=True)

    logger.info(
        "SOURCE: kb | used_chunks=%s sources=%s",
        used,
        [s["chunk_id"] for s in sources],
    )

    return {
        "answer": answer,
        "sources": sources,
        "answer_source": ANSWER_SOURCE_KB,
        "execution_trace": _trace(state, "Generate KB Answer"),
    }


# ============================================================
# NODE 5 — WEB SEARCH (TAVILY, FALLBACK ONLY)
# ============================================================


def web_search_tavily(state: AgentState):
    """Search the web with Tavily. Reached ONLY when the private KB is
    insufficient — it never replaces Pinecone. A Tavily failure is captured
    (non-fatal) so the workflow degrades to an honest insufficient response."""

    query = state.get("current_query") or state["original_query"]

    logger.info("WEB_SEARCH: used | query=%s", query)

    try:
        result = web_search_tool().invoke({"query": query})
    except Exception as exc:  # noqa: BLE001 - Tavily unavailable is non-fatal
        logger.exception("Tavily web search failed")
        return {
            "web_results": [],
            "web_evidence": _format_web_results([]),
            "errors": _errors(state, f"web_search_tavily: {exc}"),
            "execution_trace": _trace(state, "Tavily Web Search: unavailable"),
        }

    web_results = []
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
            web_results.append(
                {
                    "type": "search_result",
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "content": item.get("content", ""),
                }
            )
    else:
        web_results.append(
            {
                "type": "raw",
                "title": "Web Search Result",
                "url": "",
                "content": str(result),
            }
        )

    logger.info("Tavily returned %d results", len(web_results))

    return {
        "web_results": web_results,
        "web_evidence": _format_web_results(web_results),
        "execution_trace": _trace(
            state,
            f"Tavily Web Search → {len(web_results)} results",
        ),
    }


# ============================================================
# NODE 6 — GRADE WEB EVIDENCE
# ============================================================


def grade_web_evidence(state: AgentState):
    """Decide whether the Tavily results are sufficient. Never generates the
    answer. A malformed grader response is treated as insufficient."""

    evidence = state.get("web_evidence") or _format_web_results(
        state.get("web_results", [])
    )

    try:
        grade = llm().with_structured_output(
            EvidenceGrade,
            method="json_mode",
        ).invoke(
            f"""
You are an evidence evaluator. The private company knowledge base did NOT contain
the answer, so external web evidence was retrieved. Evaluate whether the web
evidence is sufficient to answer the question reliably.

User question:
{state["original_query"]}

Current search query:
{state.get("current_query", "")}

Web evidence:
{evidence}

Return ONLY valid JSON:
{{"sufficient": true|false, "reason": "<one sentence>", "confidence": <0.0-1.0>}}
"""
        )
        web_grade = {
            "sufficient": bool(grade.sufficient),
            "reason": grade.reason or "",
            "confidence": float(grade.confidence or 0.0),
        }
    except Exception as exc:  # noqa: BLE001 - malformed grader response
        logger.exception("Web grader failed; treating evidence as insufficient")
        web_grade = {
            "sufficient": False,
            "reason": f"grader error: {exc}",
            "confidence": 0.0,
        }
        return {
            "web_grade": web_grade,
            "web_evidence": evidence,
            "errors": _errors(state, f"grade_web_evidence: {exc}"),
            "execution_trace": _trace(state, "Web Evidence Grading: error → insufficient"),
        }

    logger.info(
        "Web evidence grade: sufficient=%s confidence=%.2f reason=%s",
        web_grade["sufficient"],
        web_grade["confidence"],
        web_grade["reason"],
    )

    return {
        "web_grade": web_grade,
        "web_evidence": evidence,
        "execution_trace": _trace(
            state,
            "Web Evidence Grading: sufficient"
            if web_grade["sufficient"]
            else "Web Evidence Grading: insufficient",
        ),
    }


def after_web(state: AgentState) -> Literal["generate_web_answer", "rewrite_query_retry"]:
    """Web sufficient -> generate from web; otherwise rewrite + retry."""
    if state.get("web_grade", {}).get("sufficient"):
        return "generate_web_answer"
    return "rewrite_query_retry"


# ============================================================
# NODE 7 — GENERATE ANSWER FROM WEB
# ============================================================


def generate_web_answer(state: AgentState):
    """Generate the answer using ONLY the retrieved web evidence, clearly marked
    as external (not company policy)."""

    evidence = state.get("web_evidence") or _format_web_results(
        state.get("web_results", [])
    )

    answer = llm().invoke(
        f"""
You are an enterprise HR policy and employee support copilot.

The private company knowledge base did NOT contain the answer, so the information
below comes from EXTERNAL public web sources — NOT from company policy.

Answer ONLY using the provided web evidence.

Rules:
1. Do not invent facts and do not use information outside the evidence.
2. Include only information supported by the web evidence.
3. Clearly state the information comes from public external sources, not company
   policy. Never present public information as this company's policy, and never
   claim a festival/holiday is a company holiday.
4. If the question asks for official company policy and no company policy was
   found, explicitly say company-specific information could not be confirmed.
5. Present facts (e.g. festival/holiday names and dates) accurately. If several
   are relevant, list them with dates. Avoid unsupported superlatives such as
   "the most widely celebrated" unless a source explicitly says so.
6. If sources conflict, mention the conflict.
7. Keep the answer concise and practical, in plain prose or a short simple list.
8. Write a clean answer for the employee. Do NOT include raw evidence markers
   such as "Web Result 1", "【Web Result N】", bracketed source indices, or URLs
   inline. Sources are shown to the user separately as citations.

User question:
{state["original_query"]}

External web evidence:
{evidence}
"""
    ).content.strip()

    sources = _web_sources(state.get("web_results", []))

    logger.info("SOURCE: web | sources=%s", [s["url"] for s in sources])

    return {
        "answer": answer,
        "sources": sources,
        "answer_source": ANSWER_SOURCE_WEB,
        "execution_trace": _trace(state, "Generate Web Answer"),
    }


# ============================================================
# NODE 8 — QUERY REWRITE & RETRY
# ============================================================


def rewrite_query_retry(state: AgentState):
    """Both KB and web evidence were insufficient. Rewrite the question into a
    better search query (preserving intent) and increment the retry counter. The
    conditional edge routes back to NODE 2 while retries remain. A rewrite
    failure is non-fatal: we keep the previous query and still count the retry,
    so the loop always terminates."""

    question = state["original_query"]
    previous = state.get("current_query") or question

    try:
        rewritten = llm().invoke(
            f"""
Rewrite the following user question into a better retrieval query so the next
search (private HR knowledge base first, then web) is more likely to find good
evidence.

Rules:
- Preserve the original intent exactly.
- Remove ambiguity where possible.
- Add useful context/keywords (include the year and country/jurisdiction when
  relevant).
- Do not answer the question.
- Return ONLY the rewritten query (no quotes, no explanation).

Original question:
{question}

Previous query:
{previous}
"""
        ).content.strip()
    except Exception as exc:  # noqa: BLE001 - rewrite failure is non-fatal
        logger.exception("Query rewrite failed; keeping the previous query")
        rewritten = previous
        return {
            "rewritten_query": previous,
            "current_query": previous,
            "retry_count": state.get("retry_count", 0) + 1,
            "errors": _errors(state, f"rewrite_query_retry: {exc}"),
            "execution_trace": _trace(state, "Query Rewrite (failed → kept previous)"),
        }

    if not rewritten:
        rewritten = previous

    new_retry_count = state.get("retry_count", 0) + 1

    logger.info("Query rewrite %d: %s", new_retry_count, rewritten)

    return {
        "rewritten_query": rewritten,
        "current_query": rewritten,
        "retry_count": new_retry_count,
        "execution_trace": _trace(
            state,
            f"Query Rewrite → {rewritten}",
        ),
    }


def after_rewrite(state: AgentState) -> Literal["retrieve_pinecone", "final_answer"]:
    """Retry the retrieval while retries remain; otherwise stop (prevents
    infinite loops)."""
    if state.get("retry_count", 0) <= state.get("max_retries", settings.max_retries):
        return "retrieve_pinecone"
    return "final_answer"


# ============================================================
# NODE 9 — FINAL ANSWER WITH SOURCES
# ============================================================


def final_answer(state: AgentState):
    """Assemble the final response: answer + sources + execution trace, and make
    the answer_source explicit (kb | web | insufficient). When the retry limit
    was reached without sufficient evidence, produce a controlled
    insufficient-evidence response."""

    answer = (state.get("answer") or "").strip()
    answer_source = state.get("answer_source") or ANSWER_SOURCE_INSUFFICIENT
    sources = state.get("sources", [])

    if not answer:
        # Retry limit reached with insufficient KB + web evidence.
        answer_source = ANSWER_SOURCE_INSUFFICIENT
        answer = (
            "I couldn't find enough reliable information — in either the "
            "company's private HR knowledge base or trusted external sources — "
            "to answer this confidently. Please confirm with your HR team."
        )
        trace = _trace(state, "Final Answer → insufficient evidence")
    else:
        label = {
            ANSWER_SOURCE_KB: "Final Answer → Private HR Knowledge Base",
            ANSWER_SOURCE_WEB: "Final Answer → External Web Search",
            ANSWER_SOURCE_INSUFFICIENT: "Final Answer → insufficient evidence",
        }.get(answer_source, "Final Answer")
        trace = _trace(state, label)

    logger.info("FINAL: answer_source=%s sources=%d", answer_source, len(sources))

    return {
        "answer": answer,
        "answer_source": answer_source,
        "sources": sources,
        "execution_trace": trace,
    }


# ============================================================
# BUILD GRAPH
# ============================================================


def build_graph():
    graph = StateGraph(AgentState)

    # ---- The nine nodes ----
    graph.add_node("router", router)
    graph.add_node("retrieve_pinecone", retrieve_pinecone)
    graph.add_node("grade_kb_evidence", grade_kb_evidence)
    graph.add_node("generate_kb_answer", generate_kb_answer)
    graph.add_node("web_search_tavily", web_search_tavily)
    graph.add_node("grade_web_evidence", grade_web_evidence)
    graph.add_node("generate_web_answer", generate_web_answer)
    graph.add_node("rewrite_query_retry", rewrite_query_retry)
    graph.add_node("final_answer", final_answer)

    # ---- START -> Router -> Pinecone -> Grade KB ----
    graph.add_edge(START, "router")
    graph.add_edge("router", "retrieve_pinecone")
    graph.add_edge("retrieve_pinecone", "grade_kb_evidence")

    # ---- KB sufficient? ----
    graph.add_conditional_edges(
        "grade_kb_evidence",
        after_kb,
        {
            "generate_kb_answer": "generate_kb_answer",
            "web_search_tavily": "web_search_tavily",
        },
    )

    # ---- Web fallback -> Grade Web ----
    graph.add_edge("web_search_tavily", "grade_web_evidence")

    # ---- Web sufficient? ----
    graph.add_conditional_edges(
        "grade_web_evidence",
        after_web,
        {
            "generate_web_answer": "generate_web_answer",
            "rewrite_query_retry": "rewrite_query_retry",
        },
    )

    # ---- Retry (bounded) back to retrieval, else finalize ----
    graph.add_conditional_edges(
        "rewrite_query_retry",
        after_rewrite,
        {
            "retrieve_pinecone": "retrieve_pinecone",
            "final_answer": "final_answer",
        },
    )

    # ---- Generators -> Final Answer -> END ----
    graph.add_edge("generate_kb_answer", "final_answer")
    graph.add_edge("generate_web_answer", "final_answer")
    graph.add_edge("final_answer", END)

    return graph.compile()


agent_graph = build_graph()


# ============================================================
# ASK
# ============================================================


def ask(question: str):
    """Run the 9-node Agentic RAG graph for a single question.

    Returns the final state, including:
        answer, sources, execution_trace, answer_source ("kb"|"web"|"insufficient")
    """

    question = (question or "").strip()

    if not question:
        raise ValueError("Question cannot be empty.")

    initial: AgentState = {
        "original_query": question,
        "current_query": question,
        "retrieved_documents": [],
        "kb_evidence": "",
        "kb_grade": {},
        "web_results": [],
        "web_evidence": "",
        "web_grade": {},
        "rewritten_query": "",
        "retry_count": 0,
        "max_retries": settings.max_retries,
        "answer": "",
        "sources": [],
        "execution_trace": [],
        "answer_source": ANSWER_SOURCE_INSUFFICIENT,
        "errors": [],
    }

    return agent_graph.invoke(initial)
