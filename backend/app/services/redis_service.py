"""Redis cache service for HR answers.

A thin, FAILURE-SAFE wrapper around the shared sync Redis client
(``app.core.redis.redis_client``). Redis is a cache, not the source of truth, so
every method swallows connection/serialization errors, logs a warning, and
degrades gracefully — the RAG pipeline must always run and the user must always
get an answer even when Redis is unavailable.

Logging markers (no confidential policy content or user data is logged):
    CACHE HIT / CACHE MISS / CACHE SET / REDIS UNAVAILABLE
"""

import hashlib
import json
import logging
import re

from app.core.config import get_settings
from app.core.redis import redis_client


logger = logging.getLogger(__name__)

settings = get_settings()


# Bumping CACHE_VERSION invalidates every previously cached answer at once
# (e.g. after a knowledge-base/policy refresh, or when the key derivation
# changes) without needing per-key deletes. v2 added conversation-history
# awareness, so it must not collide with v1 (question-only) keys.
CACHE_VERSION = "v2"
# Base namespace shared by every version; used for SCAN-based invalidation so a
# KB refresh clears old-version keys too.
KEY_NAMESPACE = "hr:answer"
KEY_PREFIX = f"{KEY_NAMESPACE}:{CACHE_VERSION}"

# Collapse runs of whitespace so cosmetically-different questions share a key.
_WHITESPACE = re.compile(r"\s+")

# Separates the question from the history transcript inside the hashed payload.
# A control character that never appears in natural question/answer text.
_FIELD_SEP = "\x1f"


def normalize_question(question: str) -> str:
    """Trim, lowercase, and collapse internal whitespace."""
    return _WHITESPACE.sub(" ", (question or "").strip().lower())


def _normalize_history(chat_history) -> str:
    """Canonical string for the recent-conversation window used as context.

    Only the ordered ``role: content`` turns matter (cosmetic whitespace/case is
    normalized away). An empty/None history yields "" so a cold, context-free
    question keeps a stable key shared across users and conversations.
    """
    if not chat_history:
        return ""
    parts = []
    for turn in chat_history:
        role = (turn.get("role") or "").strip().lower()
        content = normalize_question(turn.get("content") or "")
        if role and content:
            parts.append(f"{role}:{content}")
    return _FIELD_SEP.join(parts)


def generate_cache_key(question: str, chat_history=None) -> str:
    """Deterministic cache key: ``hr:answer:<version>:<sha256(question+history)>``.

    The payload is hashed (SHA-256) rather than stored verbatim, so the key is
    fixed-length, URL/CLI-safe, and never puts raw HR questions or conversation
    content into Redis key space.

    Scoping decision (why history — not user_id/conversation_id — is in the key):
    the answer now depends on the recent conversation (``workflow.ask`` uses it to
    resolve follow-ups), so two turns with the same text but different preceding
    history can legitimately differ, and MUST NOT share a cache entry. Keying on
    the *content* of the history window (rather than on user_id/conversation_id)
    gives correctness without unnecessary fragmentation:

      * Same question + same recent history  -> same key (correct HIT).
      * Same question + different history    -> different key (no wrong answer).
      * Cold question, empty history         -> one stable key shared by everyone
        (the company-wide KB answer is identical), so no per-user duplication.

    This is safe because no per-user private data reaches the generated answer:
    personal lookups resolve to a safe "insufficient" response regardless of
    caller, and the KB is company-wide. If per-user/role/tenant personalization
    is ever added to the answer, add that identity to the payload here.
    """
    payload = normalize_question(question)
    history = _normalize_history(chat_history)
    if history:
        payload = f"{payload}{_FIELD_SEP}{history}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"{KEY_PREFIX}:{digest}"


class RedisService:
    """Static, failure-safe cache operations."""

    @staticmethod
    def ping() -> bool:
        """Liveness probe for the /health endpoint. Never raises."""
        try:
            return bool(redis_client.ping())
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning("REDIS UNAVAILABLE (ping): %s", exc.__class__.__name__)
            return False

    @staticmethod
    def get(key: str):
        """Return the decoded JSON value for ``key``, or None on miss/error."""
        try:
            value = redis_client.get(key)
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning(
                "REDIS UNAVAILABLE (get %s): %s", key, exc.__class__.__name__
            )
            return None
        if value is None:
            return None
        try:
            return json.loads(value)
        except (ValueError, TypeError) as exc:
            # Corrupt/unparsable cache entry: treat as a miss.
            logger.warning("CACHE corrupt value for %s: %s", key, exc)
            return None

    @staticmethod
    def set(key: str, value, expire: int | None = None) -> None:
        """JSON-serialize ``value`` into ``key`` with a TTL. Never raises."""
        ttl = expire if expire is not None else settings.redis_cache_ttl
        try:
            redis_client.set(key, json.dumps(value), ex=ttl)
            logger.info("CACHE SET %s (ttl=%ss)", key, ttl)
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning(
                "REDIS UNAVAILABLE (set %s): %s", key, exc.__class__.__name__
            )

    @staticmethod
    def delete(key: str) -> None:
        """Delete a single key. Never raises."""
        try:
            redis_client.delete(key)
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning(
                "REDIS UNAVAILABLE (delete %s): %s", key, exc.__class__.__name__
            )

    @staticmethod
    def exists(key: str) -> bool:
        """Whether ``key`` exists. Returns False on error. Never raises."""
        try:
            return bool(redis_client.exists(key))
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning(
                "REDIS UNAVAILABLE (exists %s): %s", key, exc.__class__.__name__
            )
            return False

    @staticmethod
    def ttl(key: str) -> int:
        """Remaining TTL in seconds (-2 = no key, -1 = no expiry). Never raises."""
        try:
            return int(redis_client.ttl(key))
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning(
                "REDIS UNAVAILABLE (ttl %s): %s", key, exc.__class__.__name__
            )
            return -2

    @staticmethod
    def invalidate_answers() -> int:
        """Delete ALL cached HR answers (e.g. after a knowledge-base update).

        Uses SCAN (cursor-based), never ``KEYS *``, so it is safe on a
        shared/production Redis. Returns the number of keys deleted (0 on
        error). Never raises.
        """
        deleted = 0
        try:
            for key in redis_client.scan_iter(match=f"{KEY_NAMESPACE}:*", count=200):
                redis_client.delete(key)
                deleted += 1
            logger.info("CACHE INVALIDATED %d HR answer key(s)", deleted)
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning(
                "REDIS UNAVAILABLE (invalidate_answers): %s", exc.__class__.__name__
            )
        return deleted
