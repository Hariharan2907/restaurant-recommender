from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant
from app.schemas.search import RestaurantResult


async def upsert_many(session: AsyncSession, results: list[RestaurantResult]) -> None:
    if not results:
        return

    rows = [
        {
            "google_place_id": r.google_place_id,
            "name": r.name,
            "cuisine": r.cuisine,
            "price_tier": r.price_tier,
            "lat": r.lat,
            "lng": r.lng,
            "rating": r.rating,
        }
        for r in results
    ]

    stmt = pg_insert(Restaurant).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Restaurant.google_place_id],
        set_={
            "name": stmt.excluded.name,
            "cuisine": stmt.excluded.cuisine,
            "price_tier": stmt.excluded.price_tier,
            "lat": stmt.excluded.lat,
            "lng": stmt.excluded.lng,
            "rating": stmt.excluded.rating,
        },
    )
    await session.execute(stmt)
