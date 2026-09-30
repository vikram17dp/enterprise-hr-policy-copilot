"""Shared Redis client.

The HR chat/RAG request path is fully synchronous (sync FastAPI endpoint, sync
SQLAlchemy ``Session``, sync LangGraph ``invoke``), so we use the synchronous
Redis client and reuse ONE client (with its own connection pool) for the whole
process instead of creating a connection per request.

Redis is an OPTIONAL cache, never the source of truth. Short connect/socket
timeouts ensure that if Redis is down the client fails fast (rather than
hanging), and callers in ``RedisService`` swallow those errors so the RAG
pipeline always runs.
"""

import redis

from app.core.config import get_settings


settings = get_settings()


# decode_responses=True -> GET returns str (we store JSON strings).
# Timeouts keep a down/unreachable Redis from blocking request handling.
redis_client = redis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
    health_check_interval=30,
)
