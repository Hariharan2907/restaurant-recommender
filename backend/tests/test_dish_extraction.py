import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.models.popular_dish import PopularDish
from app.models.restaurant import Restaurant
from app.models.review import ReviewRaw
from app.services.dish_extraction import extract_dishes


def _mock_client(payload) -> SimpleNamespace:
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(
        messages=SimpleNamespace(
            create=AsyncMock(
                return_value=SimpleNamespace(content=[SimpleNamespace(text=text)])
            )
        )
    )


async def _restaurant_with_reviews(db_session) -> Restaurant:
    restaurant = Restaurant(google_place_id="g-dish", name="D", lat=0.0, lng=0.0)
    db_session.add(restaurant)
    await db_session.flush()
    db_session.add_all(
        [
            ReviewRaw(
                restaurant_id=restaurant.id,
                source="google",
                text="The pad thai is incredible",
                rating=5,
            ),
            ReviewRaw(
                restaurant_id=restaurant.id,
                source="yelp",
                text="pad thai was great, curry mediocre",
                rating=4,
            ),
        ]
    )
    await db_session.flush()
    return restaurant


@pytest.mark.asyncio
async def test_extract_dishes_replaces_rows(db_session, monkeypatch):
    restaurant = await _restaurant_with_reviews(db_session)
    # pre-existing dish should be replaced
    db_session.add(
        PopularDish(restaurant_id=restaurant.id, dish_name="stale dish")
    )
    await db_session.flush()

    monkeypatch.setattr(
        "app.services.dish_extraction.get_anthropic_client",
        lambda: _mock_client(
            [
                {
                    "dish_name": "pad thai",
                    "mention_count": 2,
                    "sentiment": 0.9,
                    "sample_quote": "The pad thai is incredible",
                },
                {"dish_name": "", "mention_count": 1},  # dropped: empty name
                {
                    "dish_name": "green curry",
                    "mention_count": 1,
                    "sentiment": -0.2,
                    "sample_quote": "curry mediocre",
                },
            ]
        ),
    )

    written = await extract_dishes(db_session, restaurant)
    assert written == 2

    dishes = (
        (
            await db_session.execute(
                select(PopularDish)
                .where(PopularDish.restaurant_id == restaurant.id)
                .order_by(PopularDish.mention_count.desc())
            )
        )
        .scalars()
        .all()
    )
    assert [d.dish_name for d in dishes] == ["pad thai", "green curry"]
    assert dishes[0].sentiment == pytest.approx(0.9)
    assert "stale dish" not in [d.dish_name for d in dishes]


@pytest.mark.asyncio
async def test_extract_dishes_soft_fails_on_bad_json(db_session, monkeypatch):
    restaurant = await _restaurant_with_reviews(db_session)
    monkeypatch.setattr(
        "app.services.dish_extraction.get_anthropic_client",
        lambda: _mock_client("not json at all"),
    )
    assert await extract_dishes(db_session, restaurant) == 0


@pytest.mark.asyncio
async def test_extract_dishes_no_reviews_is_noop(db_session, monkeypatch):
    restaurant = Restaurant(google_place_id="g-empty", name="E", lat=0.0, lng=0.0)
    db_session.add(restaurant)
    await db_session.flush()
    monkeypatch.setattr(
        "app.services.dish_extraction.get_anthropic_client",
        lambda: _mock_client([]),
    )
    assert await extract_dishes(db_session, restaurant) == 0
