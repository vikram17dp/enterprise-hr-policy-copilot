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
    IntentDecision,
    EvidenceGrade,
    GroundedAnswer,
    INTENT_HR_POLICY,
    INTENT_EMPLOYEE,
    INTENT_CALENDAR,
    INTENT_EXTERNAL,
    INTENT_ACTION,
    INTENT_GENERAL,
    INTENT_CLARIFY,
    SOURCE_INTERNAL_KB,
    SOURCE_COMPANY_CALENDAR,
    SOURCE_WEB,
    SOURCE_NONE,
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


def add_trace(state: AgentState, message: str):
    return [*state.get("trace", []), message]


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


def _format_history(history, limit: int = 6) -> str:
    if not history:
        return "(no prior conversation)"
    lines = []
    for turn in history[-limit:]:
        role = turn.get("role", "user")
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"{role}: {content}")
    return "\n".join(lines) if lines else "(no prior conversation)"


# ============================================================
# INTENT CLASSIFICATION
# ============================================================


def classify_intent(state: AgentState):
    """Semantically classify the message into one intent and produce a resolved
    internal retrieval query. This single decision selects the data source —
    internal KB, employee data, company calendar, or external web — based on
    meaning, not keywords."""

    question = state["question"]
    today = state.get("today") or date.today().isoformat()
    history = _format_history(state.get("history", []))

    classifier = llm().with_structured_output(
        IntentDecision,
        method="json_mode",
    )

    decision = classifier.invoke(
        f"""
You are the intent-classification / query-understanding layer of an
INTERNAL enterprise HR Policy Copilot for ONE specific company
("PeoplePrime Technologies").

Today's date: {today}

Choose EXACTLY ONE intent for the user's latest message.

----------------------------------------------------------------
INTENTS AND WHEN TO USE THEM
----------------------------------------------------------------

HR_POLICY  (source: internal HR knowledge base)
  General company policy that applies to everyone.
  - "What is the work from home policy?"
  - "How many annual leaves are employees entitled to?"
  - "What is the sick leave policy?"
  - "How do I request leave?" / "How do I apply for leave?"
  - "Is leave allowed during probation?"

EMPLOYEE_SPECIFIC  (source: employee data + HR policy)
  About THIS user's own records/balance/approval, or whether
  THEY personally can take leave on/around a date.
  - "How many leaves do I have (left)?"
  - "What is my remaining leave balance?"
  - "How many sick leaves have I used?"
  - "Can I take leave next week?" / "Can I get any leaves next week?"
  Signals: first/second person ("I", "my", "me") about the
  user's own entitlement/usage/approval/availability.

COMPANY_CALENDAR  (source: company holiday calendar)
  The company's OWN official holidays / closed days.
  - "What are our company holidays next month?"
  - "Is October 2 a company holiday?"
  - "Which holidays are coming next month for employees?"
  Signals: asks about the COMPANY's holidays/closed days,
  not public festivals in general.

EXTERNAL_GENERAL  (source: web search)
  Public/general information NOT specific to this company:
  festivals, public/statutory holidays, news, labor law.
  - "What is the next festival in October 2026?"
  - "When is Diwali in 2026?" / "What is Diwali?"
  - "What are the public holidays in Karnataka in October 2026?"
  - "What does Indian labor law say about maternity leave?"
  - "What is happening in the tech industry?"

ACTION_REQUEST  (source: action capability)
  The user wants the system to PERFORM an action.
  - "Apply leave for Monday." / "Submit my leave request."
  - "Create a leave request for next Friday."

GENERAL_CONVERSATION  (source: none)
  Greetings/thanks/casual chat.
  - "Hi", "Hello", "Thanks!", "How are you?"

CLARIFICATION_NEEDED  (source: none)
  The message is genuinely ambiguous between two or more of the
  above and the conversation context does NOT resolve it.
  - "What are leaves in the next coming month?" could mean the
    company holiday calendar, the leave TYPES/entitlement under
    policy, public festivals, or the user's own balance.

----------------------------------------------------------------
ROUTING RULES (mandatory)
----------------------------------------------------------------
1. Decide by MEANING, never by a single keyword. "leave" alone
   does NOT imply HR_POLICY.
2. Internal-vs-external priority:
   - "according to company policy / our company ..." -> internal
     (HR_POLICY, EMPLOYEE_SPECIFIC, or COMPANY_CALENDAR).
   - "public holidays / festival / in <country or state> / law /
     news" -> EXTERNAL_GENERAL.
3. Festivals, Diwali/Christmas dates, public or statutory
   holidays, and labor law are EXTERNAL_GENERAL — never answer
   them from the company HR handbook.
4. The COMPANY's own holidays/closed days are COMPANY_CALENDAR —
   never substitute public/external holidays for them.
5. Use the conversation history to resolve references such as
   "that", "it", or "next week"/"next month", but never let
   history override a clearly different current intent.
6. Only choose CLARIFICATION_NEEDED when genuinely ambiguous AND
   context cannot resolve it. Do NOT use it to avoid answering a
   clear question, and do NOT plan to run multiple sources.

Then produce:
- search_query: a standalone keyword-rich query for INTERNAL KB
  retrieval (resolve pronouns and relative dates using today's
  date). Empty for EXTERNAL_GENERAL / GENERAL_CONVERSATION /
  CLARIFICATION_NEEDED.
- clarification: ONLY for CLARIFICATION_NEEDED, one short friendly
  question offering the realistic interpretations (e.g. company
  holiday dates vs leave types/entitlement vs your personal
  balance). Empty otherwise.

Conversation history:
{history}

User's latest message:
{question}

Return ONLY valid JSON:
{{"intent": "<ONE_INTENT>", "search_query": "<query or empty>", "clarification": "<question or empty>"}}
"""
    )

    intent = decision.intent
    search_query = (decision.search_query or "").strip()
    clarification = (decision.clarification or "").strip()

    requires_employee_data = intent == INTENT_EMPLOYEE
    requires_action = intent == INTENT_ACTION

    logger.info(
        "QUERY: %s | INTENT: %s | requires_employee_data=%s "
        "requires_action=%s | search_query=%r",
        question,
        intent,
        requires_employee_data,
        requires_action,
        search_query,
    )

    return {
        "intent": intent,
        "current_query": search_query or question,
        "clarification": clarification,
        "requires_employee_data": requires_employee_data,
        "requires_action": requires_action,
        "source_used": intent.lower(),
        "trace": add_trace(state, f"Intent classification → {intent}"),
    }


# ============================================================
# ROUTE AFTER INTENT
# ============================================================


def route_after_intent(
    state: AgentState,
) -> Literal[
    "retrieve_kb",
    "direct_answer",
    "clarification",
    "search_web",
]:
    """Select the data source from the intent. Web search is reached ONLY for
    EXTERNAL_GENERAL — never as a fallback for an internal question."""

    intent = state.get("intent")

    if intent == INTENT_GENERAL:
        return "direct_answer"

    if intent == INTENT_CLARIFY:
        return "clarification"

    if intent == INTENT_EXTERNAL:
        return "search_web"

    # HR_POLICY, EMPLOYEE_SPECIFIC, COMPANY_CALENDAR, ACTION_REQUEST
    return "retrieve_kb"


# ============================================================
# PINECONE RETRIEVAL (with relevance scores)
# ============================================================


def retrieve_kb(state: AgentState):

    query = state.get("current_query") or state["question"]

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
        source = doc.metadata.get("source", "Unknown source")
        start_index = doc.metadata.get("start_index", "")
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


def format_kb_documents_numbered(documents) -> str:
    if not documents:
        return "No company knowledge base evidence was found."
    parts = []
    for i, doc in enumerate(documents):
        parts.append(f"[{i}] Source: {_doc_name(doc)}\n{doc.page_content}")
    return "\n\n".join(parts)


# ============================================================
# GRADE KB EVIDENCE
# ============================================================


def grade_kb(state: AgentState):

    intent = state.get("intent")

    # EMPLOYEE_SPECIFIC and ACTION_REQUEST always go to grounded generation
    # (policy + honest limitation), so grading would be a wasted LLM call.
    if intent in (INTENT_EMPLOYEE, INTENT_ACTION):
        return {
            "kb_grade": "n/a",
            "trace": add_trace(
                state,
                "KB evidence grade → SKIPPED (limitation path)",
            ),
        }

    evidence = format_kb_documents(state["kb_docs"])

    grader = llm().with_structured_output(
        EvidenceGrade,
        method="json_mode",
    )

    grade = grader.invoke(
        f"""
You are an evidence evaluator for an enterprise HR assistant.
The company knowledge base is the PRIMARY source of truth for
company-specific questions.

User question:
{state["question"]}

Company knowledge base evidence:
{evidence}

Return "good" ONLY when the evidence directly and sufficiently
addresses the question without guessing.

Return "weak" when the evidence is unrelated, only partial,
ambiguous, about a different topic, or the answer would require
information not present in the knowledge base.

Return ONLY valid JSON:
{{"grade": "good"}} or {{"grade": "weak"}}
"""
    )

    logger.info("KB evidence grade: %s", grade.grade)

    return {
        "kb_grade": grade.grade,
        "trace": add_trace(
            state,
            f"KB evidence grade → {grade.grade.upper()}",
        ),
    }


# ============================================================
# AFTER KB GRADING (internal intents NEVER fall back to web)
# ============================================================


def after_kb(
    state: AgentState,
) -> Literal[
    "generate_from_kb",
    "insufficient_internal",
    "company_calendar_unavailable",
]:

    intent = state.get("intent")

    if intent in (INTENT_EMPLOYEE, INTENT_ACTION):
        return "generate_from_kb"

    if intent == INTENT_CALENDAR:
        # Only answer from a real company-calendar source; otherwise be honest.
        if state.get("kb_grade") == "good":
            return "generate_from_kb"
        return "company_calendar_unavailable"

    # HR_POLICY
    if state.get("kb_grade") == "good":
        return "generate_from_kb"
    return "insufficient_internal"


# ============================================================
# INTENT-SPECIFIC GENERATION INSTRUCTIONS
# ============================================================


def _intent_instructions(intent: str, today: str) -> str:

    if intent == INTENT_EMPLOYEE:
        return f"""
This concerns the employee's OWN leave (balance / usage /
approval / whether they can take leave on a date). Today is {today}.

- You do NOT have access to any employee-specific leave database,
  balance, usage history, or approval records for this user.
- Do NOT invent, estimate, or guess any number or approval status.
- From the evidence, state the relevant COMPANY POLICY for context
  (e.g. annual/sick leave entitlement, the notice period, and that
  manager approval is required). If the question is date-specific,
  mention the required notice period.
- Then clearly separate policy from personal availability: whether
  THIS employee can take the leave depends on their remaining
  balance and manager approval, which you cannot verify, and direct
  them to the HR portal / HR team.
- NEVER claim the leave is approved, granted, or available.
"""

    if intent == INTENT_ACTION:
        return """
The user is asking you to PERFORM AN ACTION (e.g. apply for or
submit leave).

- The copilot CANNOT submit leave requests or perform any write
  action yet.
- NEVER claim an action was completed, submitted, or approved.
- If the evidence describes the process/policy, explain it briefly
  (portal, notice period, manager approval).
- Then clearly state the system can explain the policy but cannot
  submit the request yet, and direct the user to the HR portal or
  their manager.
"""

    if intent == INTENT_CALENDAR:
        return """
This asks about the COMPANY's official holidays/closed days.

- Answer ONLY from company-calendar evidence in the context.
- Do NOT invent holiday dates and do NOT substitute public or
  external holidays/festivals for company holidays.
- If the evidence does not actually list company holidays, say the
  company holiday calendar is not available in the knowledge base.
"""

    # HR_POLICY (default internal)
    return """
This is a general company POLICY question.

- Answer strictly from the evidence.
- If the evidence does not contain the answer, say the HR knowledge
  base does not currently contain that information.
- NEVER invent or assume a policy, and never use general internet
  knowledge as company policy.
"""


def _select_citations(docs, used_indices, force_fallback: bool):
    indices = [
        i
        for i in (used_indices or [])
        if isinstance(i, int) and 0 <= i < len(docs)
    ]

    if not indices and force_fallback and docs:
        indices = [0]  # docs already sorted by relevance (desc)

    citations = []
    seen = set()
    for i in indices:
        doc = docs[i]
        cid = _chunk_id(doc)
        if cid in seen:
            continue
        seen.add(cid)
        score = round(float(doc.metadata.get("relevance_score", 0.0)), 4)
        citations.append(
            {
                "title": _doc_name(doc),
                "url": "",
                "type": "company_knowledge_base",
                "document": _doc_name(doc),
                "chunk_id": cid,
                "relevance_score": score,
                "score": score,
            }
        )
    return citations


# ============================================================
# GENERATE FROM COMPANY KB (intent-aware, grounded)
# ============================================================


def generate_from_kb(state: AgentState):

    docs = state.get("kb_docs", [])
    intent = state.get("intent", INTENT_HR_POLICY)
    today = state.get("today") or date.today().isoformat()

    evidence = format_kb_documents_numbered(docs)

    grounded = llm().with_structured_output(
        GroundedAnswer,
        method="json_mode",
    ).invoke(
        f"""
You are an INTERNAL HR Policy Copilot for one specific company.

Answer using ONLY the retrieved internal HR policy context below
for company-policy questions.

GLOBAL RULES:
1. Never invent company policy.
2. Never assume a policy exists.
3. Never use general internet knowledge as company policy.
4. If the retrieved context does not contain the answer, say so.
5. Distinguish company policy from employee-specific information.
6. Never claim an employee's leave is approved (you have no
   approval records).
7. Never invent leave balances.
8. Never invent employee information.
9. For date-specific questions, use date info only when supported
   by policy; never conclude approval.
10. If the user asks about their personal balance and no employee
    data source exists, clearly state that limitation.
11. Cite only the internal document(s) you actually used.
12. Do not include unrelated external websites.
13. Write a clean natural-language answer. Do NOT mention chunk
    numbers, indices, "[0]", "see chunk", or any internal
    retrieval/debugging detail. "used_chunks" is metadata only.

Today's date: {today}

INTENT: {intent}

INTENT-SPECIFIC INSTRUCTIONS:
{_intent_instructions(intent, today)}

RETRIEVED INTERNAL HR EVIDENCE (chunks are numbered):
{evidence}

User question:
{state["question"]}

Respond with JSON only:
{{"answer": "<concise answer for the employee>", "used_chunks": [<indices actually used>]}}

Set "used_chunks" to [] if no chunk genuinely contributed.
"""
    )

    answer = (grounded.answer or "").strip()
    used = grounded.used_chunks or []

    force_fallback = intent == INTENT_HR_POLICY
    citations = _select_citations(docs, used, force_fallback)

    source_type = SOURCE_INTERNAL_KB

    logger.info(
        "SOURCE: %s | intent=%s used_chunks=%s citations=%s",
        source_type,
        intent,
        used,
        [c["chunk_id"] for c in citations],
    )

    return {
        "answer": answer,
        "source_used": "company_knowledge_base",
        "source_type": source_type,
        "citations": citations,
        "trace": add_trace(
            state,
            f"Answer generation → COMPANY KNOWLEDGE BASE ({intent})",
        ),
    }


# ============================================================
# INSUFFICIENT INTERNAL EVIDENCE (no web fallback)
# ============================================================


def insufficient_internal(state: AgentState):

    logger.info(
        "SOURCE: internal_kb (insufficient) | intent=%s — grounded limitation, "
        "no web fallback.",
        state.get("intent"),
    )

    return {
        "answer": (
            "The available HR knowledge base does not currently contain "
            "enough information to answer this confidently. Please confirm "
            "with your HR team."
        ),
        "source_used": "insufficient_evidence",
        "source_type": SOURCE_INTERNAL_KB,
        "citations": [],
        "trace": add_trace(
            state,
            "Stopped → internal KB insufficient (no web fallback)",
        ),
    }


# ============================================================
# COMPANY CALENDAR UNAVAILABLE
# ============================================================


def company_calendar_unavailable(state: AgentState):

    logger.info(
        "SOURCE: company_calendar (none found) | intent=%s — no company "
        "holiday data in KB; refusing to substitute external holidays.",
        state.get("intent"),
    )

    return {
        "answer": (
            "I don't have a company holiday calendar in the HR knowledge base, "
            "so I can't confirm this company's official holidays or closed days "
            "for that period. I won't substitute public or external holiday "
            "lists for company holidays. Please check the official company "
            "calendar or ask your HR team."
        ),
        "source_used": "company_calendar_unavailable",
        "source_type": SOURCE_COMPANY_CALENDAR,
        "citations": [],
        "trace": add_trace(
            state,
            "Stopped → company calendar unavailable (no external substitute)",
        ),
    }


# ============================================================
# CLARIFICATION (ambiguous question)
# ============================================================


def clarification(state: AgentState):

    question = (state.get("clarification") or "").strip() or (
        "Could you clarify what you mean? For example, are you asking about "
        "the company's official holiday dates, the types of leave and "
        "entitlement under the HR policy, or your own remaining leave balance?"
    )

    logger.info("SOURCE: none | intent=CLARIFICATION_NEEDED")

    return {
        "answer": question,
        "source_used": "clarification",
        "source_type": SOURCE_NONE,
        "citations": [],
        "trace": add_trace(
            state,
            "Stopped → clarification requested (ambiguous intent)",
        ),
    }


# ============================================================
# DIRECT ANSWER (general conversation)
# ============================================================


def direct_answer(state: AgentState):

    answer = llm().invoke(
        f"""
You are a friendly enterprise HR assistant.

The user sent a simple conversational message. Respond naturally
and briefly.

Do not search the web. Do not retrieve company documents. Do not
invent HR policy.

User:
{state["question"]}
"""
    ).content.strip()

    logger.info("SOURCE: none | intent=GENERAL_CONVERSATION")

    return {
        "answer": answer,
        "source_used": "direct",
        "source_type": SOURCE_NONE,
        "citations": [],
        "trace": add_trace(
            state,
            "Direct response → GENERAL CONVERSATION",
        ),
    }


# ============================================================
# WEB SEARCH (EXTERNAL_GENERAL only)
# ============================================================


def search_web(state: AgentState):

    query = state.get("current_query") or state["question"]

    logger.info("WEB_SEARCH: used | query=%s", query)

    result = web_search_tool().invoke({"query": query})

    web_results = []
    citations = []

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
            title = item.get("title", "")
            url = item.get("url", "")
            content = item.get("content", "")

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
                        "document": title or url,
                        "domain": _domain(url),
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
        "citations": citations,
        "source_used": "web_search",
        "source_type": SOURCE_WEB,
        "trace": add_trace(
            state,
            f"Tavily search → {len(web_results)} results",
        ),
    }


# ============================================================
# FORMAT WEB RESULTS
# ============================================================


def format_web_results(web_results: list[dict]) -> str:
    if not web_results:
        return "No web evidence was found."

    formatted = []
    for index, item in enumerate(web_results, start=1):
        title = item.get("title", "")
        url = item.get("url", "")
        content = item.get("content", "")
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

    evidence = format_web_results(state["web_results"])

    grader = llm().with_structured_output(
        EvidenceGrade,
        method="json_mode",
    )

    grade = grader.invoke(
        f"""
You are an evidence evaluator. The user asked a GENERAL/EXTERNAL
question (not company policy). Evaluate the external web evidence.

User question:
{state["question"]}

Current search query:
{state["current_query"]}

Web evidence:
{evidence}

Return "good" ONLY when the evidence directly relates to the
question, contains enough reliable information to answer it, and
does not require unsupported assumptions. Otherwise return "weak".

Return ONLY valid JSON:
{{"grade": "good"}} or {{"grade": "weak"}}
"""
    )

    logger.info("Web evidence grade: %s", grade.grade)

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
) -> Literal["generate_from_web", "rewrite_query", "insufficient"]:

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
Rewrite the following user question into a better public web
search query.

Rules:
- Preserve the original intent.
- Make the query specific; add useful keywords.
- Include the year and country/jurisdiction when relevant.
- Do not answer the question.
- Return ONLY the rewritten query (no quotes, no explanation).

Original question:
{state["question"]}

Previous search query:
{state["current_query"]}
"""
    ).content.strip()

    new_retry_count = state["retry_count"] + 1

    logger.info("Query rewrite %d: %s", new_retry_count, rewritten)

    return {
        "current_query": rewritten,
        "retry_count": new_retry_count,
        "trace": add_trace(state, f"Query rewrite → {rewritten}"),
    }


# ============================================================
# GENERATE FROM WEB (external only)
# ============================================================


def generate_from_web(state: AgentState):

    evidence = format_web_results(state["web_results"])

    answer = llm().invoke(
        f"""
You are an enterprise HR policy and employee support copilot.

The user asked a GENERAL/EXTERNAL question. The information below
comes from EXTERNAL public web sources — NOT from company policy.

Answer ONLY using the provided web evidence.

Rules:
1. Do not invent facts and do not use information outside the
   evidence.
2. Present facts (e.g. festival/holiday names and their dates)
   accurately. If several are relevant, list them with dates.
3. Do NOT use unsupported superlatives such as "the most widely
   celebrated" unless a source explicitly says so.
4. Clearly state the information comes from public external
   sources, not company policy.
5. Never present public information as this company's policy, and
   never claim a festival/holiday is a company holiday.
6. If sources conflict, mention the conflict.
7. Keep the answer concise and practical, in plain prose or a short
   simple list.
8. Write a clean answer for the employee. Do NOT include raw
   evidence markers such as "Web Result 1", "【Web Result N】",
   bracketed source indices, or URLs inline. Sources are shown to
   the user separately as citations.

User question:
{state["question"]}

External web evidence:
{evidence}
"""
    ).content.strip()

    logger.info("SOURCE: web | intent=%s", state.get("intent"))

    return {
        "answer": answer,
        "source_used": "web_search",
        "source_type": SOURCE_WEB,
        "citations": state.get("citations", []),
        "trace": add_trace(
            state,
            "Answer generation → WEB SEARCH (external)",
        ),
    }


# ============================================================
# INSUFFICIENT EVIDENCE (external path)
# ============================================================


def insufficient(state: AgentState):

    logger.info("SOURCE: web (insufficient) | intent=%s", state.get("intent"))

    return {
        "answer": (
            "I couldn't find enough reliable information from the available "
            "sources to answer this confidently."
        ),
        "source_used": "insufficient_evidence",
        "source_type": SOURCE_WEB,
        "citations": state.get("citations", []),
        "trace": add_trace(state, "Stopped → insufficient evidence"),
    }


# ============================================================
# BUILD GRAPH
# ============================================================


def build_graph():

    graph = StateGraph(AgentState)

    # ---- Nodes ----
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("retrieve_kb", retrieve_kb)
    graph.add_node("grade_kb", grade_kb)
    graph.add_node("generate_from_kb", generate_from_kb)
    graph.add_node("insufficient_internal", insufficient_internal)
    graph.add_node("company_calendar_unavailable", company_calendar_unavailable)
    graph.add_node("clarification", clarification)
    graph.add_node("search_web", search_web)
    graph.add_node("grade_web", grade_web)
    graph.add_node("rewrite_query", rewrite_query)
    graph.add_node("generate_from_web", generate_from_web)
    graph.add_node("direct_answer", direct_answer)
    graph.add_node("insufficient", insufficient)

    # ---- START → intent ----
    graph.add_edge(START, "classify_intent")

    graph.add_conditional_edges(
        "classify_intent",
        route_after_intent,
        {
            "retrieve_kb": "retrieve_kb",
            "direct_answer": "direct_answer",
            "clarification": "clarification",
            "search_web": "search_web",
        },
    )

    # ---- Internal KB path ----
    graph.add_edge("retrieve_kb", "grade_kb")

    graph.add_conditional_edges(
        "grade_kb",
        after_kb,
        {
            "generate_from_kb": "generate_from_kb",
            "insufficient_internal": "insufficient_internal",
            "company_calendar_unavailable": "company_calendar_unavailable",
        },
    )

    graph.add_edge("generate_from_kb", END)
    graph.add_edge("insufficient_internal", END)
    graph.add_edge("company_calendar_unavailable", END)

    # ---- External web path (EXTERNAL_GENERAL only) ----
    graph.add_edge("search_web", "grade_web")

    graph.add_conditional_edges(
        "grade_web",
        after_web,
        {
            "generate_from_web": "generate_from_web",
            "rewrite_query": "rewrite_query",
            "insufficient": "insufficient",
        },
    )

    graph.add_edge("rewrite_query", "search_web")
    graph.add_edge("generate_from_web", END)
    graph.add_edge("insufficient", END)

    # ---- Small talk / clarification ----
    graph.add_edge("direct_answer", END)
    graph.add_edge("clarification", END)

    return graph.compile()


# ============================================================
# COMPILE GRAPH
# ============================================================


agent_graph = build_graph()


# ============================================================
# ASK
# ============================================================


def ask(question: str, history: list[dict] | None = None):
    """Run the agentic RAG graph for a single question.

    `history` is an optional bounded list of prior turns
    (``[{"role": "user"|"assistant", "content": "..."}]``) used only to resolve
    references during intent classification.
    """

    question = question.strip()

    if not question:
        raise ValueError("Question cannot be empty.")

    initial: AgentState = {
        "question": question,
        "current_query": question,
        "intent": "",
        "source_type": SOURCE_NONE,
        "requires_employee_data": False,
        "requires_action": False,
        "clarification": "",
        "today": date.today().isoformat(),
        "history": history or [],
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

    return agent_graph.invoke(initial)
