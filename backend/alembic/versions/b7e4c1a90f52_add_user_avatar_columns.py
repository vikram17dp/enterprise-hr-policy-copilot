"""add avatar_url and avatar_public_id to users

Revision ID: b7e4c1a90f52
Revises: 5647a6362785
Create Date: 2026-09-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e4c1a90f52'
down_revision: Union[str, Sequence[str], None] = '5647a6362785'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))
    op.add_column('users', sa.Column('avatar_public_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'avatar_public_id')
    op.drop_column('users', 'avatar_url')
