from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_or_create_user(
    db: Session,
    auth_user_id,
    email: str,
    full_name: str | None = None,
):
    result = db.execute(
        select(User).where(
            User.auth_user_id == auth_user_id
        )
    )

    user = result.scalar_one_or_none()

    if user:
        return user

    user = User(
        auth_user_id=auth_user_id,
        email=email,
        full_name=full_name,
        role="employee",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user