"""admin dashboard: additive columns + admin_query_meta + system_settings

Supports the Admin Dashboard without touching the employee chat pipeline:

* users.status / users.department  — user management (activate/suspend, dept).
* documents.category / updated_at / source_key / cloudinary_public_id — policy
  management (category filter, updated date, stable Pinecone document_id for
  replace/delete, Cloudinary cleanup).
* admin_query_meta — query workflow state (status/category/admin note) kept in
  its OWN 1:1 table so `conversations`/`messages` and their RLS are untouched.
* system_settings — editable, NON-SECRET admin settings (key/value).
* Indexes for the admin list/filter/sort queries.

All changes are additive and non-breaking. Existing rows receive safe defaults.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users: status + department ---
    op.add_column(
        'users',
        sa.Column('status', sa.String(length=20), nullable=False,
                  server_default=sa.text("'active'")),
    )
    op.add_column(
        'users',
        sa.Column('department', sa.String(length=100), nullable=True),
    )

    # --- documents: category + source_key + cloudinary_public_id + updated_at ---
    op.add_column(
        'documents',
        sa.Column('category', sa.String(length=100), nullable=True),
    )
    op.add_column(
        'documents',
        sa.Column('source_key', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'documents',
        sa.Column('cloudinary_public_id', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'documents',
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )

    # --- admin_query_meta (1:1 with conversations) ---
    op.create_table(
        'admin_query_meta',
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False,
                  server_default=sa.text("'open'")),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('conversation_id'),
    )

    # --- system_settings (key/value, non-secret) ---
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('key'),
    )

    # --- indexes for admin list/filter/sort ---
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_index(op.f('ix_users_status'), 'users', ['status'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'],
                    unique=False)
    op.create_index(op.f('ix_documents_status'), 'documents', ['status'], unique=False)
    op.create_index(op.f('ix_documents_category'), 'documents', ['category'],
                    unique=False)
    op.create_index(op.f('ix_admin_query_meta_status'), 'admin_query_meta', ['status'],
                    unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_admin_query_meta_status'), table_name='admin_query_meta')
    op.drop_index(op.f('ix_documents_category'), table_name='documents')
    op.drop_index(op.f('ix_documents_status'), table_name='documents')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_users_status'), table_name='users')
    op.drop_index(op.f('ix_users_role'), table_name='users')

    op.drop_table('system_settings')
    op.drop_table('admin_query_meta')

    op.drop_column('documents', 'updated_at')
    op.drop_column('documents', 'cloudinary_public_id')
    op.drop_column('documents', 'source_key')
    op.drop_column('documents', 'category')

    op.drop_column('users', 'department')
    op.drop_column('users', 'status')
