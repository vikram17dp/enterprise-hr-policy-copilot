# Latency Diagnosis — GET /api/v1/conversations (and GET /api/v1/conversations/{id})

Date: 2026-10-04 · Status: **DIAGNOSIS ONLY — nothing optimized, rewritten, cached, or moved.**
Constraints honored: no architecture change, no Redis on this endpoint, no caching, no LLM/LangGraph/Pinecone/RAG changes.

Temporary artifacts (remove when diagnosis concludes, all marked `# TEMP-LATENCY-DIAG`):
- `backend/app/core/dependencies.py` — per-request auth timings on `request.state`
- `backend/app/api/v1/endpoints/conversations.py` — per-phase timings + `_diag()` log writer
- `backend/_latency_diag.log` — scratch log of live request lines
- `backend/_latency_probe.py` — throwaway DB round-trip probe

---

## 1. Live instrumented capture (real user traffic, 23:50:44–45)

```
23:50:44 [CONVERSATIONS] auth: 394 ms / supabase: 643 ms / transform: 0 ms / total: 1038 ms
23:50:44 [CONVERSATIONS][detail] jwks_verify: 0 ms / user_select(incl pool checkout+pre_ping): 393 ms / list_select: 130 ms / counts(2): 256 ms / last_question(2): 256 ms / queries: 6 / rows: 2
23:50:45 [CONVERSATIONS] auth: 365 ms / supabase: 591 ms / transform: 0 ms / total: 963 ms
23:50:45 [CONVERSATIONS][detail] jwks_verify: 1 ms / user_select(incl pool checkout+pre_ping): 364 ms / list_select: 115 ms / counts(2): 241 ms / last_question(2): 235 ms / queries: 6 / rows: 2
```

Two list requests ~1 s apart for one page interaction = **duplicate frontend requests confirmed live**.
Server totals 963–1038 ms match the observed ~933 ms "Waiting for server response".

## 2. DB layer in isolation (probe, same engine settings, host aws-0-ap-northeast-2.pooler.supabase.com)

| Operation | ms |
| --- | --- |
| Cold connect (TCP + TLS + PG auth) | 1686–1982 |
| Single query round trip (SELECT 1) | 223–260 |
| Pooled checkout incl. `pool_pre_ping` | 111–126 |
| `users` SELECT (auth lookup) | 137–918 (jitter) |
| `conversations` SELECT | 122 |
| per-conversation `count` query | ~116 each |
| per-conversation `last_question` query | ~114 each |
| detail: conversation SELECT / messages SELECT | 122 / 119 |
| JWKS fetch (cold / warm) | 909 / 0 |

## 3. Bottleneck

Sequential remote round trips = query count × ~120–250 ms network distance:
auth users SELECT (1) + list SELECT (1) + 2×N (count + last_question per conversation).
N=2 → 6 queries ≈ 963–1038 ms; N=3 → 8 queries ≈ 1.2–1.7 s.
`transform`/serialization = 0 ms. Python/FastAPI overhead negligible.
First request after every `fastapi dev` reload additionally pays JWKS cold ~0.9 s and, if the pool is empty, a cold DB connect ~1.7–2 s.

## 4. Frontend vs backend split

- ~933 ms Waiting (TTFB) = backend, and within backend = DB round trips (auth 365–395 ms + endpoint queries 590–645 ms).
- ~1.6 s Stalled = client-side, before the request is dispatched. Ranked suspects:
  1. `apiFetch` builds a NEW supabase client per call and awaits `getSession()`; an expired 1-hour token makes each fresh client run its own GoTrue refresh before `fetch()` is queued (verify: Network tab shows `POST .../auth/v1/token?grant_type=refresh_token` immediately before slow calls).
  2. `next dev` (Turbopack) on-demand compile/hydrate delay before effects run.
  3. Queueing of the duplicate requests.
- Supabase is responsible as distance × query count, not per-query slowness.

## 5. Duplicate request matrix (dev; StrictMode default-on confirmed in bundled Next 16 docs)

| Route / action | GET /conversations | GET /conversations/{id} |
| --- | --- | --- |
| Load `/chat/{id}` | 3 (2× StrictMode mount + 1 on activeId flip) | 1 (loadedRef guards StrictMode) |
| Load `/ask` | 2 | 0 |
| First question on `/ask` | +2 (conversation created + router.replace) | 0 (store guard) |
| Load `/conversations` page | 2 (page effect, StrictMode) | 0 |
| Sidebar click → other `/chat/{id}` | 2 (pathname + activeId) | 1 |

Cause: `ConversationSidebar` effect deps `[fetchConversations, pathname, activeId]` + StrictMode double mount.
Production build halves the StrictMode portion; the dep-driven refetches remain.

## 6. Screenshot case (`/chat/bd8aacd5…` stuck on "Loading conversation…")

Spinner = `GET /conversations/{id}` = auth (1 RTT) + conversation SELECT + messages SELECT ≈ 0.5–1.2 s warm,
more if it absorbed post-reload cold start (JWKS + cold connect). Sidebar rendered first because its request
was dispatched earlier and/or the detail request paid the cold-start cost. Neither endpoint is hung; both are RTT-bound.

## 7. Recommended optimization order (NOT implemented)

1. Collapse the N+1 into one aggregate query (LEFT JOIN LATERAL / windowed count + DISTINCT ON last user message): 6→2 RTTs, ≈ −500–700 ms per list call.
2. Remove the per-request auth round trip: join `users` by `auth_user_id` in the same statement, or short in-process TTL cache of `auth_user_id → user.id`: ≈ −120–400 ms per request.
3. Frontend dedupe: module-singleton supabase client (single refresh lock, in-memory session) + sidebar refetch on mutation only (drop `pathname`/`activeId` deps or add a guard): removes 1–2 wasted ~1 s requests per navigation.
4. Pool warm-up / `pool_pre_ping` tuning (−111–126 ms per checkout after idle).
5. Only then: response caching / DB-region discussion (explicitly out of scope for now).
