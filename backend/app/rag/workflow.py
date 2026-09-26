"""LangGraph Agentic RAG workflow for the HR Policy Copilot.

EXACTLY nine logical stages, wired with conditional edges:

    NODE 1  router                (LLM)   decompose the question into
                                          information requirements + route to KB
    NODE 2  retrieve_pinecone             semantic search over private HR KB
    NODE 3  grade_kb_evidence     (LLM)   grade EACH requirement against the KB
    NODE 4  generate_kb_answer    (LLM)   answer the KB-supported requirements
    NODE 5  web_search_tavily             search ONLY the missing public
                                          requirements (fallback, never first)
    NODE 6  grade_web_evidence    (LLM)   grade EACH missing requirement vs web
    NODE 7  generate_web_answer   (LLM)   answer the web-resolved requirements
    NODE 8  rewrite_query_retry   (LLM)   rewrite ONLY unresolved requirements
    NODE 9  final_answer          (LLM)   merge KB + web + unresolved, sources,
                                          trace, answer_source

Flow (requirement-level, so mixed KB+WEB questions combine both sources):
    START -> router -> retrieve_pinecone -> grade_kb_evidence
        all supported / partial -> generate_kb_answer
                                      public req still missing? yes -> web_search
                                                                  no  -> final
        all missing + public     -> web_search_tavily
        all missing + internal   -> rewrite_query_retry
    web_search_tavily -> grade_web_evidence
        web resolved -> generate_web_answer -> final_answer
        web missing  -> rewrite_query_retry
    rewrite_query_retry
        retries left?  yes -> (public unresolved -> web_search_tavily
                               else -> retrieve_pinecone)
                     no  -> final_answer
    final_answer -> END

The private HR knowledge base is ALWAYS attempted before Tavily. Tavily is a
fallback used ONLY for public/current requirements the KB could not answer.
Internal company policy is never overridden by web results. No extra agents,
nodes, or branches beyond the nine above.
"""

import json
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
    KBGrade,
    WebGrade,
    GroundedAnswer,
    SOURCE_INTERNAL_KB,
    SOURCE_WEB,
    ANSWER_SOURCE_KB,
    ANSWER_SOURCE_WEB,
    ANSWER_SOURCE_KB_WEB,
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


def _format_requirements(requirements) -> str:
    """Render requirements as JSON for grader/generator prompts."""
    if not requirements:
        return "[]"
    slim = [
        {
            "id": r.get("id", ""),
            "topic": r.get("topic", ""),
            "source": r.get("source", SOURCE_INTERNAL_KB),
        }
        for r in requirements
    ]
    return json.dumps(slim, ensure_ascii=False)


def _req_source(req: dict) -> str:
    src = (req.get("source") or SOURCE_INTERNAL_KB).upper()
    return SOURCE_WEB if src == SOURCE_WEB else SOURCE_INTERNAL_KB


def _missing_web_requirements(missing) -> list[dict]:
    """The still-unresolved requirements that must be answered from the WEB."""
    return [m for m in (missing or []) if _req_source(m) == SOURCE_WEB]


def _build_web_query(missing) -> str:
    """Build a targeted Tavily query from ONLY the missing public requirements.

    Company-specific requirements already answered by the KB are never appended,
    so Tavily is not asked about internal policy and cannot override it.
    """
    web_reqs = _missing_web_requirements(missing)
    pool = web_reqs or (missing or [])
    topics = [
        (r.get("topic") or "").strip()
        for r in pool
        if (r.get("topic") or "").strip()
    ]
    if not topics:
        return ""
    query = " AND ".join(dict.fromkeys(topics))  # de-dup, preserve order
    if web_reqs:
        query = f"{query} (current, as of {date.today().isoformat()})"
    return query


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
    """Understand the employee's question and decompose it into information
    requirements, each tagged INTERNAL_KB or WEB. This is a single router, not a
    multi-agent system, and it does NOT rewrite the user's intent or answer the
    question. The private KB is always searched first.
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

Your job is to (a) decompose the employee's question into its distinct
information requirements and (b) produce ONE clean, standalone retrieval query
for the company's PRIVATE HR knowledge base. The private knowledge base is
ALWAYS searched first; do not decide to skip it. Do NOT answer the question and
do NOT rewrite the user's intent.

Decomposition rules:
- A simple single-topic question yields exactly ONE requirement.
- A MIXED question (company info + public/current info) yields one requirement
  per distinct information need.

Assign each requirement's `source`:
- Company-specific HR policies, company holidays, company leave types/rules,
  company procedures, and private employee data -> "INTERNAL_KB".
- Current government announcements, current statutory/public information, and
  other current external information -> "WEB".
- Never allow public web information to override company policy: company
  holidays/leave/policy are ALWAYS "INTERNAL_KB", even if similar public info
  exists.

Rules for current_query (the KB retrieval query):
- Build it from the INTERNAL_KB requirement topics. If there are no INTERNAL_KB
  requirements, build it from the whole question.
- Resolve pronouns and relative dates (e.g. "recent", "next month") against
  today's date.
- Make it keyword-rich and self-contained for semantic retrieval.
- Do NOT answer the question. Do NOT add outside facts.

Return ONLY valid JSON:
{{
  "next_step": "retrieve_kb",
  "current_query": "<retrieval query>",
  "requirements": [
    {{"id": "<snake_case_id>", "topic": "<what is needed>", "source": "INTERNAL_KB"|"WEB"}}
  ]
}}

Employee question:
{question}
"""
        )

        current_query = (decision.current_query or "").strip() or question
        requirements = [
            {
                "id": (r.id or f"req_{i}").strip(),
                "topic": (r.topic or "").strip(),
                "source": SOURCE_WEB
                if (r.source or "").upper() == SOURCE_WEB
                else SOURCE_INTERNAL_KB,
            }
            for i, r in enumerate(decision.requirements or [])
            if (r.topic or "").strip()
        ]
    except Exception as exc:  # noqa: BLE001 - router failure is non-fatal
        logger.exception("Router failed; falling back to the raw question")
        return {
            "current_query": question,
            "requirements": [
                {"id": "general", "topic": question, "source": SOURCE_INTERNAL_KB}
            ],
            "errors": _errors(state, f"router: {exc}"),
            "execution_trace": _trace(state, "Router Agent (fallback: raw query)"),
        }

    if not requirements:
        requirements = [
            {"id": "general", "topic": question, "source": SOURCE_INTERNAL_KB}
        ]

    logger.info(
        "QUERY: %s | ROUTER query=%r requirements=%s",
        question,
        current_query,
        [(r["id"], r["source"]) for r in requirements],
    )

    return {
        "current_query": current_query,
        "requirements": requirements,
        "execution_trace": _trace(
            state,
            f"Router Agent → {len(requirements)} requirement(s)",
        ),
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
# NODE 3 — GRADE KB EVIDENCE (PER REQUIREMENT)
# ============================================================


def grade_kb_evidence(state: AgentState):
    """Grade EACH information requirement independently against the retrieved
    internal KB evidence — never the whole question as one binary decision. A
    mixed question can be PARTIALLY supported: the KB-supported requirements are
    kept and only the missing public requirements go to the web. A malformed
    grader response is treated as everything-missing.
    """

    question = state["original_query"]
    requirements = state.get("requirements") or []
    evidence = state.get("kb_evidence") or _format_kb_documents(
        state.get("retrieved_documents", [])
    )
    req_json = _format_requirements(requirements)

    try:
        grade = llm().with_structured_output(
            KBGrade,
            method="json_mode",
        ).invoke(
            f"""
You are an evidence grader for an enterprise HR policy knowledge base.

Evaluate EACH information requirement independently using ONLY the retrieved
internal company HR documents. Do not use outside knowledge.

For each requirement decide one of:
- "supported": the retrieved internal documents contain sufficient evidence to
  answer that specific requirement.
- "partially_supported": the documents answer part of that requirement.
- "missing": the internal KB does not contain that information.

IMPORTANT:
- A mixed question may be PARTIALLY supported. Do NOT mark the entire question
  insufficient just because one requirement is missing.
- Company-specific information must be answered from the internal company HR KB.
- Do NOT substitute public holidays for company holidays.
- Do NOT infer employee leave balances.
- Do NOT reveal private employee information.
- Set "requires_web" true ONLY when a missing/partially_supported requirement is
  public/current information (source "WEB").

Return ONLY valid JSON:
{{
  "overall_status": "sufficient | partial | insufficient",
  "requirements": [
    {{"id": "...", "topic": "...", "source_required": "INTERNAL_KB|WEB",
      "status": "supported | partially_supported | missing", "evidence": "..."}}
  ],
  "requires_web": true,
  "confidence": 0.0
}}

Question:
{question}

Requirements:
{req_json}

Retrieved internal HR evidence:
{evidence}
"""
        )
    except Exception as exc:  # noqa: BLE001 - malformed grader response
        logger.exception("KB grader failed; treating all requirements as missing")
        missing = [dict(r) for r in requirements]
        kb_grade = {
            "overall_status": "insufficient",
            "requirements": [],
            "requires_web": any(_req_source(r) == SOURCE_WEB for r in missing),
            "confidence": 0.0,
            "reason": f"grader error: {exc}",
        }
        return {
            "kb_grade": kb_grade,
            "kb_evidence": evidence,
            "supported_requirements": [],
            "missing_requirements": missing,
            "kb_answer_requirements": [],
            "web_query": _build_web_query(missing),
            "errors": _errors(state, f"grade_kb_evidence: {exc}"),
            "execution_trace": _trace(
                state, "KB Evidence Grading: error → all requirements missing"
            ),
        }

    # Normalize the per-requirement grades against the router's requirement list
    # so every requirement ends up classified even if the LLM omitted one.
    by_id = {g.id: g for g in (grade.requirements or []) if getattr(g, "id", None)}
    supported: list[dict] = []
    missing: list[dict] = []
    normalized: list[dict] = []

    for req in requirements:
        rid = req.get("id", "")
        g = by_id.get(rid)
        if g is None:
            status = "missing"
            ev = ""
        else:
            status = g.status or "missing"
            ev = g.evidence or ""
        source = _req_source(req)
        normalized.append(
            {"id": rid, "topic": req.get("topic", ""), "source": source,
             "status": status, "evidence": ev}
        )
        if status in ("supported", "partially_supported"):
            supported.append({"id": rid, "topic": req.get("topic", ""), "source": source})
        else:
            missing.append({"id": rid, "topic": req.get("topic", ""), "source": source})

    requires_web = bool(grade.requires_web) or any(
        _req_source(m) == SOURCE_WEB for m in missing
    )

    overall = grade.overall_status
    if not missing:
        overall = "sufficient"
    elif not supported:
        overall = "insufficient"
    else:
        overall = "partial"

    kb_grade = {
        "overall_status": overall,
        "requirements": normalized,
        "requires_web": requires_web,
        "confidence": float(grade.confidence or 0.0),
    }

    logger.info(
        "KB grade: overall=%s supported=%s missing=%s requires_web=%s conf=%.2f",
        overall,
        [s["id"] for s in supported],
        [m["id"] for m in missing],
        requires_web,
        kb_grade["confidence"],
    )

    return {
        "kb_grade": kb_grade,
        "kb_evidence": evidence,
        "supported_requirements": supported,
        "missing_requirements": missing,
        "kb_answer_requirements": [s["topic"] for s in supported if s.get("topic")],
        "web_query": _build_web_query(missing),
        "execution_trace": _trace(
            state,
            f"KB Evidence Grading → {overall}"
            f" (supported: {len(supported)}, missing: {len(missing)})",
        ),
    }


def after_kb(
    state: AgentState,
) -> Literal["generate_kb_answer", "web_search_tavily", "rewrite_query_retry"]:
    """Route on the KB grade:
    - some/all requirements supported -> generate the KB answer (it then decides
      whether the still-missing public requirements need Tavily);
    - everything missing but public    -> go straight to Tavily;
    - everything missing and internal  -> rewrite & retry the KB retrieval.
    """
    kb_grade = state.get("kb_grade", {})
    overall = kb_grade.get("overall_status", "insufficient")

    if overall in ("sufficient", "partial"):
        return "generate_kb_answer"
    if kb_grade.get("requires_web"):
        return "web_search_tavily"
    return "rewrite_query_retry"


# ============================================================
# NODE 4 — GENERATE ANSWER FROM KB
# ============================================================


def generate_kb_answer(state: AgentState):
    """Generate the answer for ONLY the requirements supported by the internal
    company KB. Public/current requirements are left for the web stage; the KB
    answer never includes government/public information.
    """

    docs = state.get("retrieved_documents", [])
    evidence = state.get("kb_evidence") or _format_kb_documents(docs)
    today = date.today().isoformat()
    answer_topics = state.get("kb_answer_requirements") or [
        s.get("topic", "") for s in state.get("supported_requirements", [])
    ]
    topics_block = "\n".join(f"- {t}" for t in answer_topics if t) or (
        "- The employee's question (company-specific parts only)"
    )

    grounded = llm().with_structured_output(
        GroundedAnswer,
        method="json_mode",
    ).invoke(
        f"""
You are an INTERNAL HR Policy Copilot for one specific company.

Answer ONLY the following company-specific requirement(s), using ONLY the
retrieved internal HR knowledge-base evidence below:
{topics_block}

Rules:
1. Do not hallucinate and do not introduce unsupported HR policies.
2. Prefer the company's private HR documents.
3. Answer ONLY the requirement(s) listed above. Do NOT answer public/current
   requirements (e.g. government announcements) and do NOT add government or
   generic public information here — those are handled separately.
4. Do not substitute public holidays for company holidays.
5. Never invent leave balances, approvals, or employee-specific records. If a
   requirement needs the employee's own data (balance/usage/approval) and it is
   not in the evidence, state the relevant COMPANY POLICY for context and clearly
   explain you cannot verify their personal availability — direct them to the HR
   portal / HR team. Never claim leave is approved or available. Never reveal
   another employee's private information.
6. If the retrieved context does not contain the answer for a listed requirement,
   clearly say the HR knowledge base does not currently contain that information.
7. Write clean natural language. Do NOT mention chunk numbers, indices, "[0]",
   "see chunk", or any internal retrieval/debugging detail. "used_chunks" is
   metadata only.

Today's date: {today}

RETRIEVED INTERNAL HR EVIDENCE (chunks are numbered):
{evidence}

Original employee question (for context only):
{state["original_query"]}

Respond with JSON only:
{{"answer": "<concise answer covering ONLY the listed requirement(s)>", "used_chunks": [<indices actually used>]}}

Set "used_chunks" to [] if no chunk genuinely contributed.
"""
    )

    kb_answer = (grounded.answer or "").strip()
    used = grounded.used_chunks or []
    kb_sources = _select_kb_sources(docs, used, force_fallback=True)

    logger.info(
        "SOURCE: kb | used_chunks=%s sources=%s",
        used,
        [s["chunk_id"] for s in kb_sources],
    )

    return {
        "kb_answer": kb_answer,
        "kb_sources": kb_sources,
        "execution_trace": _trace(state, "Generate KB Answer"),
    }


def after_kb_answer(state: AgentState) -> Literal["web_search_tavily", "rewrite_query_retry", "final_answer"]:
    """After the KB answer: if a PUBLIC requirement is still unresolved, search
    the web for it (keeping the KB answer). If only an INTERNAL requirement is
    unresolved, rewrite & retry the KB. Otherwise finalize."""
    missing = state.get("missing_requirements", [])
    if not missing:
        return "final_answer"
    if _missing_web_requirements(missing):
        return "web_search_tavily"
    return "rewrite_query_retry"


# ============================================================
# NODE 5 — WEB SEARCH (TAVILY, MISSING PUBLIC REQUIREMENTS ONLY)
# ============================================================


def web_search_tavily(state: AgentState):
    """Search the web with Tavily for ONLY the missing public requirements.
    Reached only after the private KB was attempted — it never replaces Pinecone
    and is never asked about company-specific requirements the KB answered. A
    Tavily failure is captured (non-fatal) so the workflow degrades honestly.
    """

    query = (state.get("web_query") or "").strip()
    if not query:
        query = _build_web_query(state.get("missing_requirements", []))
    if not query:
        query = state.get("current_query") or state["original_query"]

    retry = state.get("retry_count", 0)
    label = "Tavily Web Search (retry)" if retry else "Tavily Web Search"

    logger.info("WEB_SEARCH: used | query=%s", query)

    try:
        result = web_search_tool().invoke({"query": query})
    except Exception as exc:  # noqa: BLE001 - Tavily unavailable is non-fatal
        logger.exception("Tavily web search failed")
        return {
            "web_results": [],
            "web_evidence": _format_web_results([]),
            "errors": _errors(state, f"web_search_tavily: {exc}"),
            "execution_trace": _trace(state, f"{label}: unavailable"),
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
            f"{label} → {len(web_results)} results (targeted: missing public requirement)",
        ),
    }


# ============================================================
# NODE 6 — GRADE WEB EVIDENCE (PER REQUIREMENT)
# ============================================================


def grade_web_evidence(state: AgentState):
    """Grade EACH still-missing requirement independently against the web
    evidence. Requirements already supported by the KB are NOT re-graded and are
    never marked missing here. A malformed grader response leaves the targeted
    requirements unresolved.
    """

    question = state["original_query"]
    evidence = state.get("web_evidence") or _format_web_results(
        state.get("web_results", [])
    )
    prior_missing = state.get("missing_requirements", [])
    # SAFETY GUARD: the web may only ever resolve PUBLIC requirements. Internal
    # company requirements that the KB could not answer stay unresolved here —
    # public web information must never override (or stand in for) company policy.
    web_missing = [m for m in prior_missing if _req_source(m) == SOURCE_WEB]
    internal_missing = [m for m in prior_missing if _req_source(m) != SOURCE_WEB]
    req_json = _format_requirements(web_missing)

    try:
        grade = llm().with_structured_output(
            WebGrade,
            method="json_mode",
        ).invoke(
            f"""
You are an evidence grader for external/public web sources.

The internal company KB could NOT answer the requirement(s) below, so external
web evidence was retrieved. Evaluate EACH requirement independently using ONLY
the web evidence.

For each requirement decide: "supported", "partially_supported", or "missing".

IMPORTANT:
- Grade ONLY the requirement(s) listed below.
- Do NOT mark a requirement supported unless the web evidence actually addresses
  it. Public information must NOT be treated as company policy.
- If the web evidence is insufficient, leave that requirement missing.

Return ONLY valid JSON:
{{
  "overall_status": "sufficient | partial | insufficient",
  "requirements": [
    {{"id": "...", "topic": "...", "source_required": "WEB",
      "status": "supported | partially_supported | missing", "evidence": "..."}}
  ],
  "confidence": 0.0
}}

Original question:
{question}

Missing PUBLIC requirements to grade:
{req_json}

Web evidence:
{evidence}
"""
        )
    except Exception as exc:  # noqa: BLE001 - malformed grader response
        logger.exception("Web grader failed; leaving targeted requirements unresolved")
        web_grade = {
            "overall_status": "insufficient",
            "requirements": [],
            "confidence": 0.0,
            "reason": f"grader error: {exc}",
        }
        return {
            "web_grade": web_grade,
            "web_evidence": evidence,
            "web_answer_requirements": [],
            "errors": _errors(state, f"grade_web_evidence: {exc}"),
            "execution_trace": _trace(
                state, "Web Evidence Grading: error → unresolved"
            ),
        }

    by_id = {g.id: g for g in (grade.requirements or []) if getattr(g, "id", None)}
    resolved: list[dict] = []
    still_missing_web: list[dict] = []

    for req in web_missing:
        rid = req.get("id", "")
        g = by_id.get(rid)
        status = (g.status if g is not None else "missing") or "missing"
        if status in ("supported", "partially_supported"):
            resolved.append(req)
        else:
            still_missing_web.append(req)

    # `missing_requirements` is the running unresolved list. Internal requirements
    # can never be resolved by the web, so they always remain unresolved here.
    unresolved = [*still_missing_web, *internal_missing]

    overall = "sufficient" if not unresolved and resolved else (
        "partial" if resolved and unresolved else "insufficient"
    )

    web_grade = {
        "overall_status": overall,
        "requirements": [
            {
                "id": r.get("id", ""),
                "topic": r.get("topic", ""),
                "status": (by_id[r["id"]].status if r.get("id") in by_id else "missing"),
                "evidence": (by_id[r["id"]].evidence if r.get("id") in by_id else ""),
            }
            for r in web_missing
        ],
        "confidence": float(grade.confidence or 0.0),
    }

    logger.info(
        "Web grade: overall=%s resolved=%s unresolved=%s (internal kept unresolved=%d) conf=%.2f",
        overall,
        [r.get("id") for r in resolved],
        [r.get("id") for r in unresolved],
        len(internal_missing),
        web_grade["confidence"],
    )

    return {
        "web_grade": web_grade,
        "web_evidence": evidence,
        "missing_requirements": unresolved,
        "web_answer_requirements": [r.get("topic", "") for r in resolved if r.get("topic")],
        "execution_trace": _trace(
            state,
            f"Web Evidence Grading → {overall}"
            f" (resolved: {len(resolved)}, unresolved: {len(unresolved)})",
        ),
    }


def after_web(state: AgentState) -> Literal["generate_web_answer", "rewrite_query_retry"]:
    """If the web resolved any missing requirement, generate the web answer;
    otherwise rewrite & retry."""
    if state.get("web_answer_requirements"):
        return "generate_web_answer"
    return "rewrite_query_retry"


# ============================================================
# NODE 7 — GENERATE ANSWER FROM WEB
# ============================================================


def generate_web_answer(state: AgentState):
    """Generate the answer for ONLY the public/current requirements resolved from
    the web, clearly marked as external (never as company policy)."""

    evidence = state.get("web_evidence") or _format_web_results(
        state.get("web_results", [])
    )
    answer_topics = state.get("web_answer_requirements") or []
    topics_block = "\n".join(f"- {t}" for t in answer_topics if t) or (
        "- The public/current part of the employee's question"
    )
    today = date.today().isoformat()

    answer = llm().invoke(
        f"""
You are an enterprise HR policy and employee support copilot.

The private company knowledge base did NOT contain the answer to the
requirement(s) below, so this information comes from EXTERNAL public web sources
— NOT from company policy.

Answer ONLY the following public/current requirement(s):
{topics_block}

Rules:
1. Do not invent facts and do not use information outside the web evidence.
2. Include only information supported by the web evidence.
3. Clearly state the information comes from public external sources, not company
   policy. Never present public information as this company's policy, and never
   claim a festival/public holiday is a company holiday.
4. Do NOT answer company-specific requirements here (those come from the KB).
5. Present facts (e.g. names and dates) accurately. If several are relevant, list
   them with dates. Avoid unsupported superlatives unless a source states them.
6. If sources conflict, mention the conflict.
7. Keep the answer concise and practical, in plain prose or a short simple list.
8. Write a clean answer for the employee. Do NOT include raw evidence markers
   such as "Web Result 1", bracketed source indices, or URLs inline. Sources are
   shown to the user separately as citations.

Today's date: {today}

Original employee question (for context only):
{state["original_query"]}

External web evidence:
{evidence}
"""
    ).content.strip()

    web_sources = _web_sources(state.get("web_results", []))

    logger.info("SOURCE: web | sources=%s", [s["url"] for s in web_sources])

    return {
        "web_answer": answer,
        "web_sources": web_sources,
        "execution_trace": _trace(state, "Generate Web Answer"),
    }


# ============================================================
# NODE 8 — QUERY REWRITE & RETRY (UNRESOLVED REQUIREMENTS ONLY)
# ============================================================


def rewrite_query_retry(state: AgentState):
    """Rewrite ONLY the unresolved requirement(s) into one targeted query and
    increment the retry counter. Already-supported company information is never
    rewritten or re-retrieved. The conditional edge routes to the web (public
    unresolved) or back to KB retrieval (internal unresolved) while retries
    remain. A rewrite failure is non-fatal: we keep the previous query and still
    count the retry, so the loop always terminates.
    """

    question = state["original_query"]
    missing = state.get("missing_requirements", [])
    supported = state.get("supported_requirements", [])
    unresolved_topics = [m.get("topic", "") for m in missing if m.get("topic")]
    supported_topics = [s.get("topic", "") for s in supported if s.get("topic")]
    unresolved_block = "\n".join(f"- {t}" for t in unresolved_topics) or "- (none)"
    supported_block = "\n".join(f"- {t}" for t in supported_topics) or "- (none)"
    needs_web = bool(_missing_web_requirements(missing))
    previous_web_query = state.get("web_query") or ""
    previous_kb_query = state.get("current_query") or question
    today = date.today().isoformat()

    try:
        rewritten = llm().invoke(
            f"""
Rewrite ONLY the unresolved requirement(s) below into ONE better, targeted search
query so the next lookup is more likely to find good evidence.

Rules:
- Target ONLY the unresolved requirement(s). NEVER rewrite or re-ask the
  already-supported company information.
- Preserve the original intent; remove ambiguity; add useful keywords.
- Today's date is {today}. Use the CURRENT year ({today[:4]}) when a year is
  relevant — never a past year. This company ("PeoplePrime Technologies")
  operates in India, so use India/Indian jurisdiction for public/statutory
  topics unless the question clearly states another country. Do not invent a
  country or year that is not implied by the question.
- {"This query is for an external WEB search about public/current information." if needs_web else "This query is for the internal company HR knowledge base."}
- Do not answer the question.
- Return ONLY the rewritten query (no quotes, no explanation, no repetition).

Original question:
{question}

Already-supported requirements (do NOT include these):
{supported_block}

Unresolved requirement(s) to target:
{unresolved_block}

Previous web query: {previous_web_query or "(none)"}
Previous KB query: {previous_kb_query}
"""
        ).content.strip()
    except Exception as exc:  # noqa: BLE001 - rewrite failure is non-fatal
        logger.exception("Query rewrite failed; keeping the previous query")
        fallback = previous_web_query if needs_web else previous_kb_query
        patch = {
            "rewritten_query": fallback,
            "retry_count": state.get("retry_count", 0) + 1,
            "errors": _errors(state, f"rewrite_query_retry: {exc}"),
            "execution_trace": _trace(state, "Query Rewrite (failed → kept previous)"),
        }
        if needs_web:
            patch["web_query"] = fallback
        else:
            patch["current_query"] = fallback
        return patch

    if not rewritten:
        rewritten = previous_web_query if needs_web else previous_kb_query

    new_retry_count = state.get("retry_count", 0) + 1

    logger.info("Query rewrite %d (web=%s): %s", new_retry_count, needs_web, rewritten)

    patch = {
        "rewritten_query": rewritten,
        "retry_count": new_retry_count,
        "execution_trace": _trace(state, f"Query Rewrite → {rewritten}"),
    }
    if needs_web:
        patch["web_query"] = rewritten
    else:
        patch["current_query"] = rewritten
    return patch


def after_rewrite(state: AgentState) -> Literal["web_search_tavily", "retrieve_pinecone", "final_answer"]:
    """Retry while attempts remain, targeting ONLY the unresolved requirement:
    public unresolved -> Tavily; internal unresolved -> KB retrieval. Stop at the
    retry limit (prevents infinite loops)."""
    if state.get("retry_count", 0) > state.get("max_retries", settings.max_retries):
        return "final_answer"
    missing = state.get("missing_requirements", [])
    if _missing_web_requirements(missing):
        return "web_search_tavily"
    return "retrieve_pinecone"


# ============================================================
# NODE 9 — FINAL ANSWER WITH SOURCES (MERGE KB + WEB + UNRESOLVED)
# ============================================================


def _merge_answers(state: AgentState, kb_answer: str, web_answer: str,
                   unresolved: list[dict]) -> str:
    """Merge the KB answer, the web answer, and any unresolved requirements into
    one concise Markdown answer. Internal company policy always has priority for
    company-specific information. Falls back to a simple concatenation if the LLM
    merge fails, so an answer is always produced.
    """

    question = state["original_query"]
    unresolved_block = (
        "\n".join(f"- {m.get('topic', '')}" for m in unresolved if m.get("topic"))
        or "- (none)"
    )

    prompt = f"""
You are the final answer generator for an enterprise HR Policy Copilot.

Answer the user's original question by combining the evidence below.

INTERNAL COMPANY POLICY ALWAYS HAS PRIORITY FOR COMPANY-SPECIFIC INFORMATION.

Rules:
1. Use the internal HR KB answer for company policies/holidays/leave/procedures.
2. Use the web answer only for public/current information.
3. Never replace company policy with generic web information.
4. Clearly distinguish company policy from government/public information (use
   short headings and a "**Source:**" line for each part: "Private HR Knowledge
   Base" for internal, "External/current sources" for web).
5. If a requirement remains unresolved, state exactly which requirement could not
   be verified.
6. Do not invent missing information, employee leave balances, or approvals.
7. Do not expose private employee information.
8. Answer every requirement independently.
9. Do not mention internal system reasoning, retrieval, or debugging.
10. Return concise Markdown only (no preamble).

Original question:
{question}

INTERNAL HR EVIDENCE (company policy answer):
{kb_answer or "(none — the internal KB did not support any requirement)"}

WEB EVIDENCE (public/current answer):
{web_answer or "(none — no public requirement was resolved from the web)"}

UNRESOLVED REQUIREMENTS:
{unresolved_block}
"""

    try:
        return llm().invoke(prompt).content.strip()
    except Exception as exc:  # noqa: BLE001 - merge failure is non-fatal
        logger.exception("Final merge LLM failed; falling back to concatenation")
        parts = []
        if kb_answer:
            parts.append(kb_answer)
        if web_answer:
            parts.append(web_answer)
        if unresolved:
            topics = ", ".join(
                m.get("topic", "") for m in unresolved if m.get("topic")
            )
            parts.append(
                f"I could not verify the following from reliable sources: {topics}."
            )
        return "\n\n".join(p for p in parts if p).strip()


def final_answer(state: AgentState):
    """Assemble the final response: merge the KB answer, the web answer, and any
    unresolved requirements into `answer`, combine `sources`, and set an explicit
    `answer_source` (INTERNAL_KB | WEB | INTERNAL_KB + WEB | insufficient).

    A KB-only or web-only answer with nothing unresolved is passed straight
    through (no extra LLM call), preserving the existing single-source behavior.
    """

    kb_answer = (state.get("kb_answer") or "").strip()
    web_answer = (state.get("web_answer") or "").strip()
    unresolved = state.get("missing_requirements", []) or []

    kb_sources = state.get("kb_sources", []) or []
    web_sources = state.get("web_sources", []) or []
    sources = [*kb_sources, *web_sources]

    has_kb = bool(kb_answer)
    has_web = bool(web_answer)

    if has_kb and has_web:
        answer_source = ANSWER_SOURCE_KB_WEB
    elif has_kb:
        answer_source = ANSWER_SOURCE_KB
    elif has_web:
        answer_source = ANSWER_SOURCE_WEB
    else:
        answer_source = ANSWER_SOURCE_INSUFFICIENT

    if not has_kb and not has_web:
        answer = (
            "I couldn't find enough reliable information — in either the "
            "company's private HR knowledge base or trusted external sources — "
            "to answer this confidently. Please confirm with your HR team."
        )
        trace = _trace(state, "Final Answer → insufficient evidence")
    elif (has_kb and has_web) or unresolved:
        # Merge when both sources contributed, or when something is unresolved
        # and must be disclosed alongside the partial answer.
        answer = _merge_answers(state, kb_answer, web_answer, unresolved)
        label = {
            ANSWER_SOURCE_KB_WEB: "Final Answer → KB + Web (merged)",
            ANSWER_SOURCE_KB: "Final Answer → Private HR Knowledge Base (partial; unresolved disclosed)",
            ANSWER_SOURCE_WEB: "Final Answer → External Web Search (partial; unresolved disclosed)",
        }.get(answer_source, "Final Answer")
        trace = _trace(state, label)
    else:
        # Single source, nothing unresolved: pass through untouched.
        answer = kb_answer or web_answer
        label = (
            "Final Answer → Private HR Knowledge Base"
            if has_kb
            else "Final Answer → External Web Search"
        )
        trace = _trace(state, label)

    logger.info(
        "FINAL: answer_source=%s sources=%d unresolved=%d",
        answer_source,
        len(sources),
        len(unresolved),
    )

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

    # ---- KB grade: all/partial supported -> KB answer; all missing -> web/rewrite ----
    graph.add_conditional_edges(
        "grade_kb_evidence",
        after_kb,
        {
            "generate_kb_answer": "generate_kb_answer",
            "web_search_tavily": "web_search_tavily",
            "rewrite_query_retry": "rewrite_query_retry",
        },
    )

    # ---- KB answer: public requirement still missing -> Tavily; else finalize ----
    graph.add_conditional_edges(
        "generate_kb_answer",
        after_kb_answer,
        {
            "web_search_tavily": "web_search_tavily",
            "rewrite_query_retry": "rewrite_query_retry",
            "final_answer": "final_answer",
        },
    )

    # ---- Web fallback -> Grade Web ----
    graph.add_edge("web_search_tavily", "grade_web_evidence")

    # ---- Web resolved? -> web answer; else rewrite & retry ----
    graph.add_conditional_edges(
        "grade_web_evidence",
        after_web,
        {
            "generate_web_answer": "generate_web_answer",
            "rewrite_query_retry": "rewrite_query_retry",
        },
    )

    # ---- Web answer -> Final ----
    graph.add_edge("generate_web_answer", "final_answer")

    # ---- Retry (bounded): target only the unresolved requirement ----
    graph.add_conditional_edges(
        "rewrite_query_retry",
        after_rewrite,
        {
            "web_search_tavily": "web_search_tavily",
            "retrieve_pinecone": "retrieve_pinecone",
            "final_answer": "final_answer",
        },
    )

    # ---- Final Answer -> END ----
    graph.add_edge("final_answer", END)

    return graph.compile()


agent_graph = build_graph()


# ============================================================
# ASK
# ============================================================


def ask(question: str):
    """Run the 9-node Agentic RAG graph for a single question.

    Returns the final state, including:
        answer, sources, execution_trace,
        answer_source ("INTERNAL_KB"|"WEB"|"INTERNAL_KB + WEB"|"insufficient")
    """

    question = (question or "").strip()

    if not question:
        raise ValueError("Question cannot be empty.")

    initial: AgentState = {
        "original_query": question,
        "current_query": question,
        "requirements": [],
        "retrieved_documents": [],
        "kb_evidence": "",
        "kb_grade": {},
        "supported_requirements": [],
        "missing_requirements": [],
        "web_query": "",
        "web_results": [],
        "web_evidence": "",
        "web_grade": {},
        "kb_answer_requirements": [],
        "web_answer_requirements": [],
        "kb_answer": "",
        "kb_sources": [],
        "web_answer": "",
        "web_sources": [],
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
