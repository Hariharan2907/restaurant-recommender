import pytest
from sqlalchemy import select

from app.models.restaurant import Restaurant
from app.schemas.search import RestaurantResult
from app.services.restaurants import upsert_many


def _result(place_id: str, name: str, rating: float | None = None) -> RestaurantResult:
    return RestaurantResult(
        google_place_id=place_id,
        name=name,
        rating=rating,
        lat=37.7,
        lng=-122.4,
        cuisine="indian",
        price_tier=2,
    )


@pytest.mark.asyncio
async def test_upsert_many_inserts_new_rows(db_session):
    await upsert_many(db_session, [_result("g-1", "Place A", 4.0)])
    await db_session.flush()

    rows = (await db_session.execute(select(Restaurant).where(Restaurant.google_place_id == "g-1"))).scalars().all()
    assert len(rows) == 1
    assert rows[0].name == "Place A"
    assert rows[0].rating == 4.0


@pytest.mark.asyncio
async def test_upsert_many_updates_on_conflict(db_session):
    await upsert_many(db_session, [_result("g-2", "Old Name", 3.5)])
    await db_session.flush()

    await upsert_many(db_session, [_result("g-2", "New Name", 4.8)])
    await db_session.flush()

    rows = (await db_session.execute(select(Restaurant).where(Restaurant.google_place_id == "g-2"))).scalars().all()
    assert len(rows) == 1
    assert rows[0].name == "New Name"
    assert rows[0].rating == 4.8


@pytest.mark.asyncio
async def test_upsert_many_empty_list_is_noop(db_session):
    await upsert_many(db_session, [])
    # nothing to assert beyond not raising
