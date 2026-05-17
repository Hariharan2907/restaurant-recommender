"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("taste_profile_vector", Vector(1536), nullable=True),
    )

    op.create_table(
        "restaurants",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("google_place_id", sa.String(), nullable=False),
        sa.Column("yelp_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("cuisine", sa.String(), nullable=True),
        sa.Column("price_tier", sa.Integer(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column(
            "dietary_flags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "vibe_tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.UniqueConstraint("google_place_id", name="uq_restaurants_google_place_id"),
    )

    op.create_table(
        "reviews_raw",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("review_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_reviews_raw_restaurant_id", "reviews_raw", ["restaurant_id"]
    )

    op.create_table(
        "popular_dishes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dish_name", sa.String(), nullable=False),
        sa.Column(
            "mention_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("sentiment", sa.Float(), nullable=True),
        sa.Column("sample_quote", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_popular_dishes_restaurant_id", "popular_dishes", ["restaurant_id"]
    )

    op.create_table(
        "visits",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mood", sa.String(), nullable=True),
        sa.Column(
            "dishes_ordered",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("my_rating", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column(
            "visited_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_visits_user_id", "visits", ["user_id"])
    op.create_index("ix_visits_restaurant_id", "visits", ["restaurant_id"])


def downgrade() -> None:
    op.drop_index("ix_visits_restaurant_id", table_name="visits")
    op.drop_index("ix_visits_user_id", table_name="visits")
    op.drop_table("visits")

    op.drop_index("ix_popular_dishes_restaurant_id", table_name="popular_dishes")
    op.drop_table("popular_dishes")

    op.drop_index("ix_reviews_raw_restaurant_id", table_name="reviews_raw")
    op.drop_table("reviews_raw")

    op.drop_table("restaurants")
    op.drop_table("users")

    op.execute("DROP EXTENSION IF EXISTS pgcrypto")
    op.execute("DROP EXTENSION IF EXISTS vector")
