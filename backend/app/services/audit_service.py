"""Audit logging service.

Writes rows to the existing `audit_logs` table (model: AuditLog). Used by the
admin endpoints to record privileged actions (user role/status changes, policy
upload/update/delete, query status changes, settings changes, cache clears,
reindex, etc.).

Secrets are NEVER logged: callers pass short, non-sensitive `details` strings.
The write is best-effort — an audit failure must not break the primary action,
so errors are logged and swallowed.
"""

import logging
import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


logger = logging.getLogger(__name__)


def record(
    db: Session,
    *,
    actor_id: uuid.UUID | str | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: str | None = None,
    commit: bool = True,
) -> None:
    """Persist one audit-log entry. Best-effort; never raises.

    `actor_id` is the internal users.id of the admin performing the action
    (None for system/anonymous events). `commit=False` lets the caller include
    the audit row in an existing transaction.
    """
    try:
        parsed_actor = uuid.UUID(str(actor_id)) if actor_id else None
    except (ValueError, TypeError, AttributeError):
        parsed_actor = None

    try:
        entry = AuditLog(
            user_id=parsed_actor,
            action=action[:100],
            resource_type=(resource_type or None) and str(resource_type)[:100],
            resource_id=(str(resource_id)[:255] if resource_id is not None else None),
            details=(details[:2000] if details else None),
        )
        db.add(entry)
        if commit:
            db.commit()
    except Exception:  # noqa: BLE001 - auditing must never break the action
        db.rollback()
        logger.warning("Failed to write audit log for action=%s", action, exc_info=True)
