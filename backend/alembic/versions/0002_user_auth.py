"""users: supabase auth mapping

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("supabase_sub", sa.String(), nullable=True))
    op.create_unique_constraint("uq_users_supabase_sub", "users", ["supabase_sub"])
    op.create_index("ix_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_constraint("uq_users_supabase_sub", "users", type_="unique")
    op.drop_column("users", "supabase_sub")
