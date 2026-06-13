"""users: profile preference columns; restaurants: embedding ANN index

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "dietary_preferences",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "default_radius_m",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("3000"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "cuisine_likes",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "cuisine_dislikes",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ANN index for taste-profile similarity search. HNSW needs no training
    # data (unlike ivfflat) so it's safe to create on an empty table.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_embedding_hnsw "
        "ON restaurants USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_restaurants_embedding_hnsw")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "cuisine_dislikes")
    op.drop_column("users", "cuisine_likes")
    op.drop_column("users", "default_radius_m")
    op.drop_column("users", "dietary_preferences")
    op.drop_column("users", "display_name")
