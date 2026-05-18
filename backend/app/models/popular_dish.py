from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PopularDish(Base):
    __tablename__ = "popular_dishes"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    restaurant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
    )
    dish_name: Mapped[str] = mapped_column(String, nullable=False)
    mention_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    sentiment: Mapped[float | None] = mapped_column(Float, nullable=True)
    sample_quote: Mapped[str | None] = mapped_column(String, nullable=True)
