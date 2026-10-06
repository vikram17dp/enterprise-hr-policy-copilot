"""Admin Dashboard API — /api/v1/admin/*.

Every endpoint is gated by `require_admin`, which verifies the caller's role
from the database row resolved from their verified Supabase JWT. A role sent by
the frontend is NEVER trusted. Non-admins get 403.

Data sources are the EXISTING tables (users, conversations, messages, documents,
audit_logs, saved_answers, feedback) plus two additive tables introduced for the
admin experience (admin_query_meta for query workflow state, system_settings for
editable non-secret settings). No secrets are ever returned or logged.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import Date, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import require_admin
from app.db.database import get_db
from app.models.admin_query_meta import AdminQueryMeta
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.feedback import Feedback
from app.models.message import Message
from app.models.saved_answer import SavedAnswer
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.rag import vectorstore
from app.services import audit_service, document_service
from app.services.document_service import IngestionError
from app.services.redis_service import RedisService


logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/admin", tags=["Admin"])


QUERY_STATUSES = {"open", "in_progress", "resolved", "closed"}
USER_STATUSES = {"active", "suspended", "inactive"}
USER_ROLES = {"employee", "admin"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

# Settings an admin may edit at runtime. Secrets are deliberately absent.
EDITABLE_SETTINGS = {
    "company_name": str,
    "company_email": str,
    "hr_contact": str,
    "timezone": str,
    "ai_enabled": bool,
    "rag_enabled": bool,
    "top_k": int,
    "retrieval_score_threshold": float,
    "max_retries": int,
    "chat_history_max_messages": int,
    "redis_cache_ttl": int,
}
# Numeric/bool settings that also map to a live `Settings` attribute so the
# running process picks them up on subsequent call-time reads.
_RUNTIME_SETTINGS = {
    "top_k": int,
    "retrieval_score_threshold": float,
    "max_retries": int,
    "chat_history_max_messages": int,
    "redis_cache_ttl": int,
}


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _parse_uuid(value: str, label: str = "id") -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label}"
        )


def _page_params(page: int, page_size: int) -> tuple[int, int, int]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    return page, page_size, (page - 1) * page_size


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_user_row(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "status": getattr(u, "status", "active"),
        "department": getattr(u, "department", None),
        "avatar_url": u.avatar_url,
        "created_at": _iso(u.created_at),
    }


def _serialize_document(d: Document, uploader_name: str | None = None) -> dict:
    return {
        "id": str(d.id),
        "title": d.title,
        "filename": d.filename,
        "description": d.description,
        "category": d.category,
        "version": d.version,
        "status": d.status,
        "cloudinary_url": d.cloudinary_url,
        "uploaded_by": str(d.uploaded_by) if d.uploaded_by else None,
        "uploaded_by_name": uploader_name,
        "created_at": _iso(d.created_at),
        "updated_at": _iso(getattr(d, "updated_at", None)),
    }


def _conversation_snippet(conv: Conversation) -> str | None:
    """The conversation title holds the first question (set by chat_service)."""
    return conv.title


# --------------------------------------------------------------------------- #
# 1. DASHBOARD / OVERVIEW
# --------------------------------------------------------------------------- #
@router.get("/dashboard")
def admin_dashboard(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    now = _now()
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = start_today - timedelta(days=start_today.weekday())
    start_month = start_today.replace(day=1)

    # users aggregate (single round-trip)
    u = db.execute(
        select(
            func.count(User.id),
            func.count(User.id).filter(User.role == "employee"),
            func.count(User.id).filter(
                (User.role == "employee") & (User.status == "active")
            ),
            func.count(User.id).filter(User.role == "admin"),
            func.count(User.id).filter(User.status == "suspended"),
        )
    ).one()
    total_users, total_employees, active_employees, total_admins, suspended = u

    # user-messages aggregate = HR queries asked
    m = db.execute(
        select(
            func.count(Message.id).filter(Message.role == "user"),
            func.count(Message.id).filter(
                (Message.role == "user") & (Message.created_at >= start_today)
            ),
            func.count(Message.id).filter(
                (Message.role == "user") & (Message.created_at >= start_week)
            ),
            func.count(Message.id).filter(
                (Message.role == "user") & (Message.created_at >= start_month)
            ),
        )
    ).one()
    total_queries, queries_today, queries_week, queries_month = m

    total_conversations = db.execute(
        select(func.count(Conversation.id))
    ).scalar_one()

    # query status breakdown (conversations without meta default to 'open')
    status_rows = db.execute(
        select(AdminQueryMeta.status, func.count(AdminQueryMeta.conversation_id))
        .group_by(AdminQueryMeta.status)
    ).all()
    status_counts = {s: c for s, c in status_rows}
    with_meta = sum(status_counts.values())
    status_counts["open"] = status_counts.get("open", 0) + (
        total_conversations - with_meta
    )

    # documents aggregate
    d = db.execute(
        select(
            func.count(Document.id),
            func.count(Document.id).filter(
                Document.status.in_(["ready", "active", "published"])
            ),
        )
    ).one()
    total_documents, active_documents = d

    # queries over the last 14 days (chart)
    since = (start_today - timedelta(days=13))
    ot_rows = db.execute(
        select(
            cast(Message.created_at, Date),
            func.count(Message.id),
        )
        .where((Message.role == "user") & (Message.created_at >= since))
        .group_by(cast(Message.created_at, Date))
        .order_by(cast(Message.created_at, Date))
    ).all()
    queries_over_time = [{"date": str(day), "count": int(cnt)} for day, cnt in ot_rows]

    # top categories (from admin-set query categories)
    cat_rows = db.execute(
        select(AdminQueryMeta.category, func.count(AdminQueryMeta.conversation_id))
        .where(AdminQueryMeta.category.is_not(None))
        .group_by(AdminQueryMeta.category)
        .order_by(func.count(AdminQueryMeta.conversation_id).desc())
        .limit(6)
    ).all()
    top_categories = [{"category": c, "count": int(n)} for c, n in cat_rows]

    # recent queries (6)
    recent_convs = db.execute(
        select(Conversation, User, AdminQueryMeta)
        .join(User, User.id == Conversation.user_id)
        .outerjoin(
            AdminQueryMeta, AdminQueryMeta.conversation_id == Conversation.id
        )
        .order_by(Conversation.updated_at.desc())
        .limit(6)
    ).all()
    recent_queries = [
        {
            "id": str(conv.id),
            "query": _conversation_snippet(conv),
            "employee": {
                "id": str(usr.id),
                "name": usr.full_name or usr.email,
                "email": usr.email,
            },
            "status": (meta.status if meta else "open"),
            "category": (meta.category if meta else None),
            "updated_at": _iso(conv.updated_at),
        }
        for conv, usr, meta in recent_convs
    ]

    # recent activity (8 audit entries)
    activity = db.execute(
        select(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(8)
    ).all()
    recent_activity = [
        {
            "id": str(log.id),
            "action": log.action,
            "actor": (usr.email if usr else "System"),
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "created_at": _iso(log.created_at),
        }
        for log, usr in activity
    ]

    return {
        "metrics": {
            "totalUsers": int(total_users),
            "totalEmployees": int(total_employees),
            "activeEmployees": int(active_employees),
            "totalAdmins": int(total_admins),
            "suspendedUsers": int(suspended),
            "totalQueries": int(total_queries),
            "totalConversations": int(total_conversations),
            "queriesToday": int(queries_today),
            "queriesThisWeek": int(queries_week),
            "queriesThisMonth": int(queries_month),
            "openQueries": int(status_counts.get("open", 0)),
            "inProgressQueries": int(status_counts.get("in_progress", 0)),
            "resolvedQueries": int(status_counts.get("resolved", 0)),
            "closedQueries": int(status_counts.get("closed", 0)),
            "totalDocuments": int(total_documents),
            "activeDocuments": int(active_documents),
        },
        "queriesOverTime": queries_over_time,
        "queriesByStatus": [
            {"status": s, "count": int(status_counts.get(s, 0))}
            for s in ("open", "in_progress", "resolved", "closed")
        ],
        "topCategories": top_categories,
        "recentQueries": recent_queries,
        "recentActivity": recent_activity,
    }


# --------------------------------------------------------------------------- #
# 2. EMPLOYEE QUERIES (backed by conversations + messages)
# --------------------------------------------------------------------------- #
@router.get("/queries")
def list_queries(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str = Query("", max_length=200),
    status_filter: str = Query("", alias="status"),
    category: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("updated_at"),
    order: str = Query("desc"),
):
    page, page_size, offset = _page_params(page, page_size)

    meta_status = func.coalesce(AdminQueryMeta.status, "open")
    stmt = (
        select(Conversation, User, AdminQueryMeta)
        .join(User, User.id == Conversation.user_id)
        .outerjoin(AdminQueryMeta, AdminQueryMeta.conversation_id == Conversation.id)
    )
    count_stmt = (
        select(func.count(Conversation.id))
        .select_from(Conversation)
        .join(User, User.id == Conversation.user_id)
        .outerjoin(AdminQueryMeta, AdminQueryMeta.conversation_id == Conversation.id)
    )

    conditions = []
    if search.strip():
        like = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Conversation.title).like(like),
                func.lower(User.email).like(like),
                func.lower(func.coalesce(User.full_name, "")).like(like),
            )
        )
    if status_filter.strip():
        sf = status_filter.strip().lower()
        if sf not in QUERY_STATUSES:
            raise HTTPException(status_code=422, detail="Invalid status filter")
        conditions.append(meta_status == sf)
    if category.strip():
        conditions.append(
            func.lower(func.coalesce(AdminQueryMeta.category, "")).like(
                f"%{category.strip().lower()}%"
            )
        )

    if conditions:
        stmt = stmt.where(*conditions)
        count_stmt = count_stmt.where(*conditions)

    sort_map = {
        "created_at": Conversation.created_at,
        "updated_at": Conversation.updated_at,
        "status": meta_status,
        "employee": func.lower(User.email),
        "query": func.lower(func.coalesce(Conversation.title, "")),
    }
    sort_col = sort_map.get(sort, Conversation.updated_at)
    stmt = stmt.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    stmt = stmt.limit(page_size).offset(offset)

    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(stmt).all()

    conv_ids = [conv.id for conv, _, _ in rows]
    counts = {}
    last_q = {}
    if conv_ids:
        for cid, cnt in db.execute(
            select(Message.conversation_id, func.count(Message.id))
            .where(Message.conversation_id.in_(conv_ids))
            .group_by(Message.conversation_id)
        ).all():
            counts[cid] = int(cnt)
        # last user question per conversation (single grouped pass)
        sub = (
            select(
                Message.conversation_id.label("cid"),
                Message.content.label("content"),
                func.row_number()
                .over(
                    partition_by=Message.conversation_id,
                    order_by=Message.created_at.desc(),
                )
                .label("rn"),
            )
            .where(
                Message.conversation_id.in_(conv_ids),
                Message.role == "user",
            )
            .subquery()
        )
        for cid, content in db.execute(
            select(sub.c.cid, sub.c.content).where(sub.c.rn == 1)
        ).all():
            last_q[cid] = content

    items = []
    for conv, usr, meta in rows:
        items.append(
            {
                "id": str(conv.id),
                "query": _conversation_snippet(conv) or last_q.get(conv.id),
                "employee": {
                    "id": str(usr.id),
                    "name": usr.full_name or usr.email,
                    "email": usr.email,
                    "department": getattr(usr, "department", None),
                },
                "status": (meta.status if meta else "open"),
                "category": (meta.category if meta else None),
                "messageCount": counts.get(conv.id, 0),
                "createdAt": _iso(conv.created_at),
                "updatedAt": _iso(conv.updated_at),
            }
        )

    return {"items": items, "total": int(total), "page": page, "pageSize": page_size}


@router.get("/queries/{query_id}")
def get_query(
    query_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cid = _parse_uuid(query_id, "query id")
    row = db.execute(
        select(Conversation, User, AdminQueryMeta)
        .join(User, User.id == Conversation.user_id)
        .outerjoin(AdminQueryMeta, AdminQueryMeta.conversation_id == Conversation.id)
        .where(Conversation.id == cid)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Query not found")
    conv, usr, meta = row

    messages = db.execute(
        select(Message)
        .where(Message.conversation_id == cid)
        .order_by(Message.created_at.asc())
    ).scalars().all()

    audit_service.record(
        db,
        actor_id=admin.id,
        action="query.viewed",
        resource_type="conversation",
        resource_id=str(cid),
        details=f"Viewed conversation owned by {usr.email}",
    )

    return {
        "id": str(conv.id),
        "title": conv.title,
        "status": (meta.status if meta else "open"),
        "category": (meta.category if meta else None),
        "adminNote": (meta.admin_note if meta else None),
        "createdAt": _iso(conv.created_at),
        "updatedAt": _iso(conv.updated_at),
        "employee": _serialize_user_row(usr),
        "messages": [
            {
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content,
                "source": msg.source,
                "createdAt": _iso(msg.created_at),
            }
            for msg in messages
        ],
    }


class UpdateQueryRequest(BaseModel):
    status: str | None = Field(default=None)
    category: str | None = Field(default=None, max_length=100)
    admin_note: str | None = Field(default=None, max_length=4000)


def _get_or_create_meta(db: Session, cid: uuid.UUID) -> AdminQueryMeta:
    meta = db.execute(
        select(AdminQueryMeta).where(AdminQueryMeta.conversation_id == cid)
    ).scalar_one_or_none()
    if meta is None:
        meta = AdminQueryMeta(conversation_id=cid, status="open")
        db.add(meta)
    return meta


@router.patch("/queries/{query_id}")
def update_query(
    query_id: str,
    payload: UpdateQueryRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cid = _parse_uuid(query_id, "query id")
    conv = db.execute(
        select(Conversation).where(Conversation.id == cid)
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Query not found")

    meta = _get_or_create_meta(db, cid)
    changes = []
    if payload.status is not None:
        s = payload.status.strip().lower()
        if s not in QUERY_STATUSES:
            raise HTTPException(status_code=422, detail="Invalid status")
        if s != meta.status:
            changes.append(f"status {meta.status}->{s}")
        meta.status = s
    if payload.category is not None:
        meta.category = payload.category.strip()[:100] or None
        changes.append("category updated")
    if payload.admin_note is not None:
        meta.admin_note = payload.admin_note.strip()[:4000] or None
        changes.append("note updated")

    meta.updated_by = admin.id
    db.commit()
    db.refresh(meta)

    audit_service.record(
        db,
        actor_id=admin.id,
        action="query.updated",
        resource_type="conversation",
        resource_id=str(cid),
        details="; ".join(changes) or "no change",
    )

    return {
        "id": str(cid),
        "status": meta.status,
        "category": meta.category,
        "adminNote": meta.admin_note,
        "updatedAt": _iso(meta.updated_at),
    }


class AdminResponseRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


@router.post("/queries/{query_id}/response", status_code=status.HTTP_201_CREATED)
def respond_to_query(
    query_id: str,
    payload: AdminResponseRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Post an admin reply into the employee's conversation.

    Reuses the EXISTING `messages` table (role='assistant', source='admin') so
    the employee sees it in their normal chat history. No new table.
    """
    cid = _parse_uuid(query_id, "query id")
    conv = db.execute(
        select(Conversation).where(Conversation.id == cid)
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Query not found")

    msg = Message(
        conversation_id=cid,
        role="assistant",
        content=payload.message.strip(),
        source="admin",
    )
    db.add(msg)
    conv.updated_at = _now()
    db.commit()
    db.refresh(msg)

    audit_service.record(
        db,
        actor_id=admin.id,
        action="query.admin_response",
        resource_type="conversation",
        resource_id=str(cid),
        details="Admin replied to employee conversation",
    )

    return {
        "id": str(msg.id),
        "role": msg.role,
        "content": msg.content,
        "source": msg.source,
        "createdAt": _iso(msg.created_at),
    }


# --------------------------------------------------------------------------- #
# 3. USER MANAGEMENT
# --------------------------------------------------------------------------- #
@router.get("/users")
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str = Query("", max_length=200),
    role: str = Query(""),
    status_filter: str = Query("", alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    page, page_size, offset = _page_params(page, page_size)

    stmt = select(User)
    count_stmt = select(func.count(User.id)).select_from(User)
    conditions = []
    if search.strip():
        like = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(User.email).like(like),
                func.lower(func.coalesce(User.full_name, "")).like(like),
            )
        )
    if role.strip().lower():
        r = role.strip().lower()
        if r not in USER_ROLES:
            raise HTTPException(status_code=422, detail="Invalid role filter")
        conditions.append(User.role == r)
    if status_filter.strip().lower():
        s = status_filter.strip().lower()
        if s not in USER_STATUSES:
            raise HTTPException(status_code=422, detail="Invalid status filter")
        conditions.append(User.status == s)
    if conditions:
        stmt = stmt.where(*conditions)
        count_stmt = count_stmt.where(*conditions)

    total = db.execute(count_stmt).scalar_one()
    users = db.execute(
        stmt.order_by(User.created_at.desc()).limit(page_size).offset(offset)
    ).scalars().all()

    ids = [u.id for u in users]
    conv_counts, last_active = {}, {}
    if ids:
        for uid, cnt in db.execute(
            select(Conversation.user_id, func.count(Conversation.id))
            .where(Conversation.user_id.in_(ids))
            .group_by(Conversation.user_id)
        ).all():
            conv_counts[uid] = int(cnt)
        for uid, mx in db.execute(
            select(Conversation.user_id, func.max(Message.created_at))
            .join(Message, Message.conversation_id == Conversation.id)
            .where(Conversation.user_id.in_(ids))
            .group_by(Conversation.user_id)
        ).all():
            last_active[uid] = mx

    items = []
    for u in users:
        row = _serialize_user_row(u)
        row["conversationCount"] = conv_counts.get(u.id, 0)
        row["lastActive"] = _iso(last_active.get(u.id))
        items.append(row)

    return {"items": items, "total": int(total), "page": page, "pageSize": page_size}


@router.get("/users/{user_id}")
def get_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    uid = _parse_uuid(user_id, "user id")
    u = db.execute(select(User).where(User.id == uid)).scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")

    conv_count = db.execute(
        select(func.count(Conversation.id)).where(Conversation.user_id == uid)
    ).scalar_one()
    msg_count = db.execute(
        select(func.count(Message.id))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.user_id == uid)
    ).scalar_one()
    saved_count = db.execute(
        select(func.count(SavedAnswer.id)).where(SavedAnswer.user_id == uid)
    ).scalar_one()
    last_active = db.execute(
        select(func.max(Message.created_at))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.user_id == uid)
    ).scalar_one_or_none()

    recent = db.execute(
        select(Conversation)
        .where(Conversation.user_id == uid)
        .order_by(Conversation.updated_at.desc())
        .limit(8)
    ).scalars().all()

    row = _serialize_user_row(u)
    row["lastActive"] = _iso(last_active)
    row["stats"] = {
        "conversations": int(conv_count),
        "messages": int(msg_count),
        "savedAnswers": int(saved_count),
    }
    row["recentConversations"] = [
        {
            "id": str(c.id),
            "title": c.title,
            "createdAt": _iso(c.created_at),
            "updatedAt": _iso(c.updated_at),
        }
        for c in recent
    ]
    return row


class UpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    role: str | None = None
    status: str | None = None
    department: str | None = Field(default=None, max_length=100)


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    uid = _parse_uuid(user_id, "user id")
    u = db.execute(select(User).where(User.id == uid)).scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")

    changes = []

    if payload.role is not None:
        r = payload.role.strip().lower()
        if r not in USER_ROLES:
            raise HTTPException(status_code=422, detail="Invalid role")
        if uid == admin.id and r != "admin":
            raise HTTPException(
                status_code=400, detail="You cannot remove your own admin role."
            )
        if r != u.role:
            changes.append(f"role {u.role}->{r}")
        u.role = r

    if payload.status is not None:
        s = payload.status.strip().lower()
        if s not in USER_STATUSES:
            raise HTTPException(status_code=422, detail="Invalid status")
        if uid == admin.id and s != "active":
            raise HTTPException(
                status_code=400, detail="You cannot suspend or deactivate yourself."
            )
        if s != u.status:
            changes.append(f"status {u.status}->{s}")
        u.status = s

    if payload.full_name is not None:
        u.full_name = payload.full_name.strip()[:255] or None
        changes.append("name updated")

    if payload.department is not None:
        u.department = payload.department.strip()[:100] or None
        changes.append("department updated")

    db.commit()
    db.refresh(u)

    for change in changes:
        action = "user.role_changed" if change.startswith("role") else (
            "user.status_changed" if change.startswith("status") else "user.updated"
        )
        audit_service.record(
            db,
            actor_id=admin.id,
            action=action,
            resource_type="user",
            resource_id=str(uid),
            details=f"{u.email}: {change}",
        )

    row = _serialize_user_row(u)
    return row


@router.get("/users/{user_id}/conversations")
def list_user_conversations(
    user_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    uid = _parse_uuid(user_id, "user id")
    page, page_size, offset = _page_params(page, page_size)
    total = db.execute(
        select(func.count(Conversation.id)).where(Conversation.user_id == uid)
    ).scalar_one()
    convs = db.execute(
        select(Conversation)
        .where(Conversation.user_id == uid)
        .order_by(Conversation.updated_at.desc())
        .limit(page_size)
        .offset(offset)
    ).scalars().all()
    ids = [c.id for c in convs]
    counts = {}
    if ids:
        for cid, cnt in db.execute(
            select(Message.conversation_id, func.count(Message.id))
            .where(Message.conversation_id.in_(ids))
            .group_by(Message.conversation_id)
        ).all():
            counts[cid] = int(cnt)
    return {
        "items": [
            {
                "id": str(c.id),
                "title": c.title,
                "messageCount": counts.get(c.id, 0),
                "createdAt": _iso(c.created_at),
                "updatedAt": _iso(c.updated_at),
            }
            for c in convs
        ],
        "total": int(total),
        "page": page,
        "pageSize": page_size,
    }


# --------------------------------------------------------------------------- #
# 4. POLICY DOCUMENT MANAGEMENT (reuses existing ingestion)
# --------------------------------------------------------------------------- #
@router.get("/policies")
def list_policies(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str = Query("", max_length=200),
    category: str = Query("", max_length=100),
    status_filter: str = Query("", alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    page, page_size, offset = _page_params(page, page_size)
    stmt = select(Document, User).outerjoin(User, User.id == Document.uploaded_by)
    count_stmt = select(func.count(Document.id)).select_from(Document)
    conditions = []
    if search.strip():
        like = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Document.title).like(like),
                func.lower(Document.filename).like(like),
            )
        )
    if category.strip():
        conditions.append(
            func.lower(func.coalesce(Document.category, "")).like(
                f"%{category.strip().lower()}%"
            )
        )
    if status_filter.strip():
        conditions.append(Document.status == status_filter.strip().lower())
    if conditions:
        stmt = stmt.where(*conditions)
        count_stmt = count_stmt.where(*conditions)

    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(
        stmt.order_by(Document.created_at.desc()).limit(page_size).offset(offset)
    ).all()

    items = [
        _serialize_document(doc, (usr.full_name or usr.email) if usr else None)
        for doc, usr in rows
    ]
    return {"items": items, "total": int(total), "page": page, "pageSize": page_size}


@router.get("/policies/{document_id}")
def get_policy(
    document_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    did = _parse_uuid(document_id, "document id")
    row = db.execute(
        select(Document, User).outerjoin(User, User.id == Document.uploaded_by)
        .where(Document.id == did)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    doc, usr = row
    return _serialize_document(doc, (usr.full_name or usr.email) if usr else None)


@router.post("/policies", status_code=status.HTTP_201_CREATED)
async def upload_policy(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form(""),
    description: str = Form(""),
):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit.")

    clean_title = title.strip()[:255]
    if not clean_title:
        raise HTTPException(status_code=422, detail="A document title is required.")
    clean_category = category.strip()[:100] or None
    source_key = f"ADMIN-{uuid.uuid4().hex[:16].upper()}"

    doc = Document(
        title=clean_title,
        filename=file.filename or "document",
        description=description.strip()[:2000] or None,
        category=clean_category,
        source_key=source_key,
        version=1,
        status="processing",
        uploaded_by=admin.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    warnings: list[str] = []
    try:
        document_service.ingest_bytes(
            data,
            file.filename or "document",
            source_key=source_key,
            title=clean_title,
            category=clean_category,
        )
        doc.status = "ready"
    except IngestionError as exc:
        doc.status = "failed"
        db.commit()
        audit_service.record(
            db, actor_id=admin.id, action="policy.upload_failed",
            resource_type="document", resource_id=str(doc.id), details=str(exc),
        )
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        doc.status = "failed"
        db.commit()
        logger.exception("Policy ingestion failed for %s", doc.id)
        audit_service.record(
            db, actor_id=admin.id, action="policy.upload_failed",
            resource_type="document", resource_id=str(doc.id), details="ingestion error",
        )
        raise HTTPException(
            status_code=502, detail="Document ingestion failed. Please try again."
        ) from exc

    # Cloudinary storage for later download/replace — best-effort.
    stored = document_service.upload_bytes_to_cloudinary(
        data, file.filename or "document"
    )
    if stored:
        doc.cloudinary_url = stored.get("secure_url")
        doc.cloudinary_public_id = stored.get("public_id")
    else:
        warnings.append(
            "Indexed for RAG, but Cloudinary storage is unavailable — download "
            "and replace-from-storage are disabled for this document."
        )

    db.commit()
    db.refresh(doc)

    audit_service.record(
        db, actor_id=admin.id, action="policy.uploaded",
        resource_type="document", resource_id=str(doc.id),
        details=f"{doc.title} ({doc.filename})",
    )

    return {"document": _serialize_document(doc, admin.full_name or admin.email),
            "warnings": warnings}


class UpdatePolicyRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default=None, max_length=50)


@router.patch("/policies/{document_id}")
def update_policy(
    document_id: str,
    payload: UpdatePolicyRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update policy metadata and/or status (activate/deactivate/archive)."""
    did = _parse_uuid(document_id, "document id")
    doc = db.execute(select(Document).where(Document.id == did)).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    changes = []
    if payload.title is not None and payload.title.strip():
        doc.title = payload.title.strip()[:255]
        changes.append("title")
    if payload.category is not None:
        doc.category = payload.category.strip()[:100] or None
        changes.append("category")
    if payload.description is not None:
        doc.description = payload.description.strip()[:2000] or None
        changes.append("description")
    if payload.status is not None and payload.status.strip():
        s = payload.status.strip().lower()
        if s != doc.status:
            changes.append(f"status {doc.status}->{s}")
        doc.status = s

    doc.updated_at = _now()
    db.commit()
    db.refresh(doc)

    audit_service.record(
        db, actor_id=admin.id,
        action="policy.status_changed" if any(c.startswith("status") for c in changes)
        else "policy.updated",
        resource_type="document", resource_id=str(did),
        details=f"{doc.title}: {', '.join(changes) or 'no change'}",
    )
    return _serialize_document(doc, admin.full_name or admin.email)


@router.post("/policies/{document_id}/replace")
async def replace_policy(
    document_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
):
    """Replace a document's file: delete old vectors, ingest new, bump version."""
    did = _parse_uuid(document_id, "document id")
    doc = db.execute(select(Document).where(Document.id == did)).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit.")

    source_key = doc.source_key or f"ADMIN-{uuid.uuid4().hex[:16].upper()}"
    document_service.delete_vectors(source_key)

    doc.status = "processing"
    db.commit()
    try:
        document_service.ingest_bytes(
            data, file.filename or doc.filename,
            source_key=source_key, title=doc.title, category=doc.category,
        )
    except IngestionError as exc:
        doc.status = "failed"
        db.commit()
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        doc.status = "failed"
        db.commit()
        logger.exception("Replace ingestion failed for %s", did)
        raise HTTPException(status_code=502, detail="Re-ingestion failed.") from exc

    stored = document_service.upload_bytes_to_cloudinary(
        data, file.filename or doc.filename
    )
    if stored:
        if doc.cloudinary_public_id and doc.cloudinary_public_id != stored.get("public_id"):
            document_service.delete_from_cloudinary(doc.cloudinary_public_id)
        doc.cloudinary_url = stored.get("secure_url")
        doc.cloudinary_public_id = stored.get("public_id")

    doc.filename = file.filename or doc.filename
    doc.source_key = source_key
    doc.version = (doc.version or 1) + 1
    doc.status = "ready"
    doc.updated_at = _now()
    db.commit()
    db.refresh(doc)

    audit_service.record(
        db, actor_id=admin.id, action="policy.replaced",
        resource_type="document", resource_id=str(did),
        details=f"{doc.title} -> v{doc.version}",
    )
    return _serialize_document(doc, admin.full_name or admin.email)


@router.delete("/policies/{document_id}", status_code=status.HTTP_200_OK)
def delete_policy(
    document_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    did = _parse_uuid(document_id, "document id")
    doc = db.execute(select(Document).where(Document.id == did)).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    vectors_deleted = document_service.delete_vectors(doc.source_key)
    document_service.delete_from_cloudinary(doc.cloudinary_public_id)

    title, filename = doc.title, doc.filename
    db.delete(doc)
    db.commit()

    audit_service.record(
        db, actor_id=admin.id, action="policy.deleted",
        resource_type="document", resource_id=str(did),
        details=f"{title} ({filename}); vectors_deleted={vectors_deleted}",
    )
    return {"deleted": True, "id": str(did), "vectorsDeleted": vectors_deleted}


# --------------------------------------------------------------------------- #
# 5. AUDIT LOGS
# --------------------------------------------------------------------------- #
@router.get("/audit-logs")
def list_audit_logs(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str = Query("", max_length=200),
    action: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    page, page_size, offset = _page_params(page, page_size)
    stmt = select(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id)
    count_stmt = select(func.count(AuditLog.id)).select_from(AuditLog).outerjoin(
        User, User.id == AuditLog.user_id
    )
    conditions = []
    if action.strip():
        conditions.append(func.lower(AuditLog.action).like(f"%{action.strip().lower()}%"))
    if search.strip():
        like = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(AuditLog.action).like(like),
                func.lower(func.coalesce(AuditLog.details, "")).like(like),
                func.lower(func.coalesce(AuditLog.resource_id, "")).like(like),
                func.lower(func.coalesce(User.email, "")).like(like),
            )
        )
    if conditions:
        stmt = stmt.where(*conditions)
        count_stmt = count_stmt.where(*conditions)

    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(
        stmt.order_by(AuditLog.created_at.desc()).limit(page_size).offset(offset)
    ).all()

    items = [
        {
            "id": str(log.id),
            "action": log.action,
            "actor": {"id": str(usr.id), "email": usr.email} if usr else None,
            "resourceType": log.resource_type,
            "resourceId": log.resource_id,
            "details": log.details,
            "createdAt": _iso(log.created_at),
        }
        for log, usr in rows
    ]
    return {"items": items, "total": int(total), "page": page, "pageSize": page_size}


# --------------------------------------------------------------------------- #
# 6. REPORTS / ANALYTICS
# --------------------------------------------------------------------------- #
@router.get("/reports")
def admin_reports(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    now = _now()
    since = now - timedelta(days=days)

    # queries over time (user messages per day in range)
    ot = db.execute(
        select(cast(Message.created_at, Date), func.count(Message.id))
        .where((Message.role == "user") & (Message.created_at >= since))
        .group_by(cast(Message.created_at, Date))
        .order_by(cast(Message.created_at, Date))
    ).all()
    queries_over_time = [{"date": str(d), "count": int(c)} for d, c in ot]

    # by status
    status_rows = db.execute(
        select(AdminQueryMeta.status, func.count(AdminQueryMeta.conversation_id))
        .group_by(AdminQueryMeta.status)
    ).all()
    status_counts = {s: int(c) for s, c in status_rows}
    total_conv = db.execute(select(func.count(Conversation.id))).scalar_one()
    with_meta = sum(status_counts.values())
    status_counts["open"] = status_counts.get("open", 0) + (total_conv - with_meta)
    queries_by_status = [
        {"status": s, "count": status_counts.get(s, 0)}
        for s in ("open", "in_progress", "resolved", "closed")
    ]

    # by category
    cat = db.execute(
        select(AdminQueryMeta.category, func.count(AdminQueryMeta.conversation_id))
        .where(AdminQueryMeta.category.is_not(None))
        .group_by(AdminQueryMeta.category)
        .order_by(func.count(AdminQueryMeta.conversation_id).desc())
    ).all()
    queries_by_category = [{"category": c, "count": int(n)} for c, n in cat]

    # by department (user messages joined to owner's department)
    dept = db.execute(
        select(
            func.coalesce(User.department, "Unassigned"),
            func.count(Message.id),
        )
        .select_from(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .join(User, User.id == Conversation.user_id)
        .where(Message.role == "user")
        .group_by(func.coalesce(User.department, "Unassigned"))
        .order_by(func.count(Message.id).desc())
    ).all()
    queries_by_department = [{"department": d, "count": int(n)} for d, n in dept]

    # most active users (by user-message count in range)
    top_users = db.execute(
        select(User.email, func.count(Message.id))
        .select_from(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .join(User, User.id == Conversation.user_id)
        .where((Message.role == "user") & (Message.created_at >= since))
        .group_by(User.email)
        .order_by(func.count(Message.id).desc())
        .limit(8)
    ).all()
    most_active_users = [{"email": e, "queries": int(n)} for e, n in top_users]

    active_users = db.execute(
        select(func.count(func.distinct(Conversation.user_id)))
        .select_from(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Message.created_at >= since)
    ).scalar_one()
    new_users = db.execute(
        select(func.count(User.id)).where(User.created_at >= since)
    ).scalar_one()

    # documents
    doc_total = db.execute(select(func.count(Document.id))).scalar_one()
    doc_by_status = db.execute(
        select(Document.status, func.count(Document.id)).group_by(Document.status)
    ).all()
    doc_by_category = db.execute(
        select(func.coalesce(Document.category, "Uncategorized"), func.count(Document.id))
        .group_by(func.coalesce(Document.category, "Uncategorized"))
    ).all()

    # feedback
    fb_by_rating = db.execute(
        select(Feedback.rating, func.count(Feedback.id)).group_by(Feedback.rating)
    ).all()

    # cache
    redis_ok = RedisService.ping()

    return {
        "rangeDays": days,
        "queriesOverTime": queries_over_time,
        "queriesByStatus": queries_by_status,
        "queriesByCategory": queries_by_category,
        "queriesByDepartment": queries_by_department,
        "mostActiveUsers": most_active_users,
        "activeUsers": int(active_users),
        "newUsers": int(new_users),
        "documents": {
            "total": int(doc_total),
            "byStatus": [{"status": s, "count": int(n)} for s, n in doc_by_status],
            "byCategory": [
                {"category": c, "count": int(n)} for c, n in doc_by_category
            ],
        },
        "feedbackByRating": [
            {"rating": r, "count": int(n)} for r, n in fb_by_rating
        ],
        "cache": {
            "redisEnabled": bool(settings.redis_url),
            "redisStatus": "ok" if redis_ok else "unavailable",
            "cacheTtl": int(settings.redis_cache_ttl),
        },
    }


# --------------------------------------------------------------------------- #
# 7. SETTINGS
# --------------------------------------------------------------------------- #
def _load_overrides(db: Session) -> dict[str, str]:
    rows = db.execute(select(SystemSetting)).scalars().all()
    return {r.key: r.value for r in rows}


def _coerce(key: str, raw: str):
    typ = EDITABLE_SETTINGS.get(key)
    if typ is bool:
        return str(raw).lower() in {"1", "true", "yes", "on"}
    if typ is int:
        return int(raw)
    if typ is float:
        return float(raw)
    return raw


@router.get("/settings")
def get_settings_endpoint(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ov = _load_overrides(db)

    def val(key: str, default):
        if key in ov and ov[key] is not None:
            try:
                return _coerce(key, ov[key])
            except (ValueError, TypeError):
                return default
        return default

    redis_ok = RedisService.ping()
    return {
        "general": {
            "companyName": val("company_name", settings.app_name),
            "companyEmail": val("company_email", ""),
            "hrContact": val("hr_contact", ""),
            "timezone": val("timezone", "UTC"),
        },
        "ai": {
            "aiEnabled": val("ai_enabled", True),
            "ragEnabled": val("rag_enabled", True),
            "topK": val("top_k", settings.top_k),
            "retrievalScoreThreshold": val(
                "retrieval_score_threshold", settings.retrieval_score_threshold
            ),
            "maxRetries": val("max_retries", settings.max_retries),
            "chatHistoryMaxMessages": val(
                "chat_history_max_messages", settings.chat_history_max_messages
            ),
        },
        "cache": {
            "redisEnabled": bool(settings.redis_url),
            "redisStatus": "ok" if redis_ok else "unavailable",
            "cacheTtl": val("redis_cache_ttl", settings.redis_cache_ttl),
        },
        "editableKeys": sorted(EDITABLE_SETTINGS.keys()),
    }


class UpdateSettingsRequest(BaseModel):
    settings: dict[str, object]


@router.patch("/settings")
def update_settings_endpoint(
    payload: UpdateSettingsRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    changed = []
    rejected = []
    for key, raw in (payload.settings or {}).items():
        if key not in EDITABLE_SETTINGS:
            rejected.append(key)
            continue
        typ = EDITABLE_SETTINGS[key]
        try:
            if typ is bool:
                value = bool(raw) if isinstance(raw, bool) else _coerce(key, str(raw))
                stored = "true" if value else "false"
            elif typ is int:
                value = int(raw)  # type: ignore[arg-type]
                stored = str(value)
            elif typ is float:
                value = float(raw)  # type: ignore[arg-type]
                stored = str(value)
            else:
                value = str(raw)
                stored = value
        except (ValueError, TypeError):
            rejected.append(key)
            continue

        row = db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        ).scalar_one_or_none()
        if row is None:
            row = SystemSetting(key=key)
            db.add(row)
        row.value = stored
        row.updated_by = admin.id
        row.updated_at = _now()

        # best-effort runtime application for numeric/bool pipeline settings
        if key in _RUNTIME_SETTINGS:
            try:
                setattr(settings, key, value)
            except Exception:  # noqa: BLE001
                pass
        changed.append(key)

    db.commit()

    audit_service.record(
        db, actor_id=admin.id, action="settings.updated",
        resource_type="system_settings", resource_id=None,
        details=f"changed={','.join(changed) or 'none'}; rejected={','.join(rejected) or 'none'}",
    )
    return {"changed": changed, "rejected": rejected}


# --------------------------------------------------------------------------- #
# 8. MAINTENANCE + HEALTH
# --------------------------------------------------------------------------- #
@router.post("/maintenance/clear-cache")
def clear_cache(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    deleted = RedisService.invalidate_answers()
    audit_service.record(
        db, actor_id=admin.id, action="cache.cleared",
        resource_type="redis", resource_id=None,
        details=f"{deleted} cached answer(s) removed",
    )
    return {"cleared": True, "deleted": int(deleted),
            "redisStatus": "ok" if RedisService.ping() else "unavailable"}


@router.post("/maintenance/reindex")
def reindex_policies(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Re-ingest the seeded sample knowledge base (data/sample_kb) into Pinecone.

    This is the project's canonical KB source. Each file is (re)indexed under a
    stable document_id derived from its filename, and the answer cache is
    invalidated by add_documents.
    """
    folder = Path(settings.sample_kb_dir)
    if not folder.exists():
        raise HTTPException(
            status_code=404, detail=f"Sample KB folder not found: {folder}"
        )
    files = [p for p in folder.iterdir() if p.is_file()
             and p.suffix.lower() in document_service.supported_extensions()]
    if not files:
        raise HTTPException(status_code=404, detail="No ingestible files in sample KB.")

    indexed, failed = [], []
    total_vectors = 0
    for path in files:
        source_key = f"KB-{path.stem.upper()}"
        try:
            document_service.delete_vectors(source_key)
            n = document_service.ingest_path(
                path, source_key=source_key, title=path.stem, category="hr_policy"
            )
            total_vectors += n
            indexed.append({"file": path.name, "vectors": n})
        except Exception:  # noqa: BLE001
            logger.exception("Reindex failed for %s", path.name)
            failed.append(path.name)

    RedisService.invalidate_answers()
    audit_service.record(
        db, actor_id=admin.id, action="policy.reindexed",
        resource_type="knowledge_base", resource_id=None,
        details=f"{len(indexed)} file(s), {total_vectors} vectors; failed={failed or 'none'}",
    )
    return {"indexed": indexed, "failed": failed, "totalVectors": total_vectors}


@router.get("/health")
def admin_health(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    database_ok = True
    try:
        db.execute(select(func.count(User.id))).scalar_one()
    except Exception:  # noqa: BLE001
        database_ok = False

    pinecone_ok = False
    try:
        vectorstore.ensure_index()
        pinecone_ok = True
    except Exception:  # noqa: BLE001
        pinecone_ok = False

    return {
        "database": "ok" if database_ok else "error",
        "redis": "ok" if RedisService.ping() else "unavailable",
        "pinecone": "ok" if pinecone_ok else "error",
        "groqConfigured": bool(settings.groq_api_key),
        "cohereConfigured": bool(settings.cohere_api_key),
        "cloudinaryConfigured": bool(settings.cloudinary_api_key),
    }


# --------------------------------------------------------------------------- #
# 9. ADMIN PROFILE (enriched; own data only)
# --------------------------------------------------------------------------- #
@router.get("/me")
def admin_me(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = _serialize_user_row(admin)
    row["stats"] = db.execute(
        select(func.count(Conversation.id)).where(Conversation.user_id == admin.id)
    ).scalar_one()
    return row
