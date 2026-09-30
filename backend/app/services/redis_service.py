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
# (e.g. after a knowledge-base/policy refresh) without needing per-key deletes.
CACHE_VERSION = "v1"
KEY_PREFIX = f"hr:answer:{CACHE_VERSION}"

# Collapse runs of whitespace so cosmetically-different questions share a key.
_WHITESPACE = re.compile(r"\s+")


def normalize_question(question: str) -> str:
    """Trim, lowercase, and collapse internal whitespace."""
    return _WHITESPACE.sub(" ", (question or "").strip().lower())


def generate_cache_key(question: str) -> str:
    """Deterministic cache key: ``hr:answer:<version>:<sha256(normalized)>``.

    The question is hashed (SHA-256) rather than stored verbatim, so the key is
    fixed-length, URL/CLI-safe, and does not put raw HR questions into Redis key
    space.

    Scoping note: for this single-company deployment the RAG answer is a pure
    function of the question — ``workflow.ask`` takes only the question, and no
    per-user/role/tenant/personal data reaches the generated answer (personal
    lookups resolve to a safe "insufficient" response regardless of caller). So
    the key is scoped to the normalized question + a global cache version. If
    per-user/role/tenant personalization is ever added to the answer, include
    that context here so one user's answer is never served to another.
    """
    digest = hashlib.sha256(
        normalize_question(question).encode("utf-8")
    ).hexdigest()
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
            for key in redis_client.scan_iter(match=f"{KEY_PREFIX}:*", count=200):
                redis_client.delete(key)
                deleted += 1
            logger.info("CACHE INVALIDATED %d HR answer key(s)", deleted)
        except Exception as exc:  # noqa: BLE001 - Redis is optional
            logger.warning(
                "REDIS UNAVAILABLE (invalidate_answers): %s", exc.__class__.__name__
            )
        return deleted
