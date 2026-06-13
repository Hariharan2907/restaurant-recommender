import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.popular_dish import PopularDish
from app.models.restaurant import Restaurant

logger = logging.getLogger(__name__)


async def dishes_by_place_ids(
    session: AsyncSession, place_ids: list[str], per_restaurant: int = 5
) -> dict[str, list[str]]:
    """Top popular dish names keyed by google_place_id. Soft-fails to {}."""
    if not place_ids:
        return {}
    try:
        result = await session.execute(
            select(Restaurant.google_place_id, PopularDish.dish_name)
            .join(PopularDish, PopularDish.restaurant_id == Restaurant.id)
            .where(Restaurant.google_place_id.in_(place_ids))
            .order_by(PopularDish.mention_count.desc())
        )
        rows = result.all()
    except Exception as exc:  # noqa: BLE001 — dishes are garnish, not the meal
        logger.error("dishes_by_place_ids failed: %s", exc)
        return {}

    by_place: dict[str, list[str]] = {}
    for place_id, dish_name in rows:
        bucket = by_place.setdefault(place_id, [])
        if len(bucket) < per_restaurant:
            bucket.append(dish_name)
    return by_place
