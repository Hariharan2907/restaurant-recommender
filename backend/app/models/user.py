from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Integer, String, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # Supabase Auth subject (auth.users.id). Nullable so pre-auth rows survive;
    # populated on first authenticated request.
    supabase_sub: Mapped[str | None] = mapped_column(
        String, nullable=True, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    taste_profile_vector: Mapped[list[float] | None] = mapped_column(
        Vector(1536), nullable=True
    )

    # Profile preferences (Phase 3)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    dietary_preferences: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'::text[]")
    )
    default_radius_m: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("3000")
    )
    cuisine_likes: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'::text[]")
    )
    cuisine_dislikes: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'::text[]")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
