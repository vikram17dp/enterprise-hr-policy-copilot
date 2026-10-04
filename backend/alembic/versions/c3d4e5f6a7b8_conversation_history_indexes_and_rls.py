"""conversation history: indexes + row level security

Adds the ordering indexes the conversation sidebar relies on
(conversations.updated_at, messages.created_at) and enables Row Level
Security on the conversations/messages tables as defense-in-depth.

The FastAPI backend connects with the project's `postgres` owner role, which
bypasses RLS, and already validates ownership on every query. These policies
protect the tables for any direct Supabase (PostgREST) access made with a
user's JWT (`authenticated` role): a user can only touch rows that belong to
them. `auth.uid()` is the Supabase auth id, which maps to `users.auth_user_id`;
the internal `users.id` is what conversations.user_id references.

Revision ID: c3d4e5f6a7b8
Revises: b7e4c1a90f52
Create Date: 2026-10-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b7e4c1a90f52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The internal users.id for the currently authenticated Supabase user.
_OWNER = "(SELECT id FROM public.users WHERE auth_user_id = auth.uid())"


def upgrade() -> None:
    """Upgrade schema."""
    # --- Ordering indexes for the sidebar / message timeline ---
    op.create_index(
        op.f('ix_conversations_updated_at'),
        'conversations',
        ['updated_at'],
        unique=False,
    )
    op.create_index(
        op.f('ix_messages_created_at'),
        'messages',
        ['created_at'],
        unique=False,
    )

    # --- Row Level Security (defense-in-depth for direct PostgREST access) ---
    op.execute("ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY")

    # conversations: a user may only SELECT/INSERT/UPDATE/DELETE their own.
    op.execute(
        f"""
        CREATE POLICY conversations_select_own ON public.conversations
            FOR SELECT TO authenticated
            USING (user_id = {_OWNER})
        """
    )
    op.execute(
        f"""
        CREATE POLICY conversations_insert_own ON public.conversations
            FOR INSERT TO authenticated
            WITH CHECK (user_id = {_OWNER})
        """
    )
    op.execute(
        f"""
        CREATE POLICY conversations_update_own ON public.conversations
            FOR UPDATE TO authenticated
            USING (user_id = {_OWNER})
            WITH CHECK (user_id = {_OWNER})
        """
    )
    op.execute(
        f"""
        CREATE POLICY conversations_delete_own ON public.conversations
            FOR DELETE TO authenticated
            USING (user_id = {_OWNER})
        """
    )

    # messages: access is granted through ownership of the parent conversation.
    op.execute(
        f"""
        CREATE POLICY messages_select_own ON public.messages
            FOR SELECT TO authenticated
            USING (conversation_id IN (
                SELECT id FROM public.conversations WHERE user_id = {_OWNER}
            ))
        """
    )
    op.execute(
        f"""
        CREATE POLICY messages_insert_own ON public.messages
            FOR INSERT TO authenticated
            WITH CHECK (conversation_id IN (
                SELECT id FROM public.conversations WHERE user_id = {_OWNER}
            ))
        """
    )
    op.execute(
        f"""
        CREATE POLICY messages_update_own ON public.messages
            FOR UPDATE TO authenticated
            USING (conversation_id IN (
                SELECT id FROM public.conversations WHERE user_id = {_OWNER}
            ))
            WITH CHECK (conversation_id IN (
                SELECT id FROM public.conversations WHERE user_id = {_OWNER}
            ))
        """
    )
    op.execute(
        f"""
        CREATE POLICY messages_delete_own ON public.messages
            FOR DELETE TO authenticated
            USING (conversation_id IN (
                SELECT id FROM public.conversations WHERE user_id = {_OWNER}
            ))
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    for policy, table in (
        ('messages_delete_own', 'public.messages'),
        ('messages_update_own', 'public.messages'),
        ('messages_insert_own', 'public.messages'),
        ('messages_select_own', 'public.messages'),
        ('conversations_delete_own', 'public.conversations'),
        ('conversations_update_own', 'public.conversations'),
        ('conversations_insert_own', 'public.conversations'),
        ('conversations_select_own', 'public.conversations'),
    ):
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table}")

    op.execute("ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY")

    op.drop_index(op.f('ix_messages_created_at'), table_name='messages')
    op.drop_index(op.f('ix_conversations_updated_at'), table_name='conversations')
