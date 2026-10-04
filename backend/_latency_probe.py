"""TEMP-LATENCY-DIAG (delete after diagnosis).

Measures the raw round-trip cost of every database operation performed by
GET /api/v1/conversations and GET /api/v1/conversations/{id}, against the real
Supabase Postgres instance, using the same engine settings as the app
(pool_pre_ping=True). No HTTP, no JWT: isolates the DB layer only.
"""

import time
from urllib.parse import urlparse

from sqlalchemy import create_engine, func, select

from app.core.config import get_settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

settings = get_settings()

host = urlparse(settings.database_url).hostname or "?"


def ms(dt: float) -> float:
    return dt * 1000.0


def main() -> None:
    print(f"== DB latency probe -> host: {host} ==")

    engine = create_engine(settings.database_url, pool_pre_ping=True)

    # 1) Cold connection: TCP + TLS + PG auth handshake
    t = time.perf_counter()
    conn = engine.connect()
    cold = ms(time.perf_counter() - t)
    print(f"cold connect (TCP+TLS+auth):      {cold:8.1f} ms")

    # 2) Raw round trip on the open connection
    t = time.perf_counter()
    conn.execute(select(1))
    rtt = ms(time.perf_counter() - t)
    print(f"SELECT 1 (open conn, raw RTT):    {rtt:8.1f} ms")

    # 3) Return to pool, check out again -> pool_pre_ping fires
    conn.close()
    t = time.perf_counter()
    conn = engine.connect()
    checkout = ms(time.perf_counter() - t)
    t = time.perf_counter()
    conn.execute(select(1))
    warm = ms(time.perf_counter() - t)
    print(f"pooled checkout (pre_ping):       {checkout:8.1f} ms")
    print(f"SELECT 1 (pooled conn):           {warm:8.1f} ms")

    # 4) auth query: users by auth_user_id (first row)
    from sqlalchemy.orm import Session

    with Session(engine) as sess:
        t = time.perf_counter()
        user = sess.execute(select(User).limit(1)).scalar_one_or_none()
        user_sel = ms(time.perf_counter() - t)
        print(f"users SELECT (auth lookup):       {user_sel:8.1f} ms")
        if user is None:
            print("no users row found - aborting")
            return

        # 5) list query
        t = time.perf_counter()
        conversations = sess.execute(
            select(Conversation)
            .where(Conversation.user_id == user.id)
            .order_by(Conversation.updated_at.desc())
        ).scalars().all()
        list_sel = ms(time.perf_counter() - t)
        n = len(conversations)
        print(f"conversations SELECT ({n} rows):    {list_sel:8.1f} ms")

        # 6) per-conversation N+1 queries
        counts = 0.0
        lastq = 0.0
        for c in conversations:
            t = time.perf_counter()
            sess.execute(
                select(func.count(Message.id)).where(
                    Message.conversation_id == c.id
                )
            ).scalar_one()
            counts += ms(time.perf_counter() - t)

            t = time.perf_counter()
            sess.execute(
                select(Message.content)
                .where(
                    Message.conversation_id == c.id,
                    Message.role == "user",
                )
                .order_by(Message.created_at.desc())
                .limit(1)
            ).scalar_one_or_none()
            lastq += ms(time.perf_counter() - t)
        print(f"count queries x{n}:                {counts:8.1f} ms")
        print(f"last_question queries x{n}:        {lastq:8.1f} ms")

        # 7) detail endpoint queries for the first conversation
        conv_sel = msg_sel = 0.0
        if conversations:
            cid = conversations[0].id
            t = time.perf_counter()
            sess.execute(
                select(Conversation).where(Conversation.id == cid)
            ).scalar_one_or_none()
            conv_sel = ms(time.perf_counter() - t)

            t = time.perf_counter()
            msgs = sess.execute(
                select(Message)
                .where(Message.conversation_id == cid)
                .order_by(Message.created_at.asc())
            ).scalars().all()
            msg_sel = ms(time.perf_counter() - t)
            print(f"detail conversation SELECT:       {conv_sel:8.1f} ms")
            print(f"detail messages SELECT ({len(msgs)}):   {msg_sel:8.1f} ms")

    conn.close()

    list_db = list_sel + counts + lastq
    detail_db = conv_sel + msg_sel
    print()
    print("== Predicted server-side time (DB only, warm pool) ==")
    print(
        f"GET /conversations:        auth(user_sel {user_sel:.0f}) + db"
        f" {list_db:.0f} = ~{user_sel + list_db:.0f} ms  ({2 * n + 2} queries)"
    )
    print(
        f"GET /conversations/{{id}}:  auth(user_sel {user_sel:.0f}) + db"
        f" {detail_db:.0f} = ~{user_sel + detail_db:.0f} ms  (3 queries)"
    )
    print(
        f"note: first request after idle also pays pooled checkout pre_ping"
        f" ~{checkout:.0f} ms per connection checkout"
    )

    engine.dispose()


if __name__ == "__main__":
    main()
