import pytest
import respx
from httpx import Response
from sqlalchemy import select

from app.config import get_settings
from app.models.restaurant import Restaurant
from app.models.review import ReviewRaw
from app.services.reviews import (
    fetch_google_reviews,
    fetch_yelp_reviews,
    store_reviews,
)


@pytest.fixture
def api_keys(monkeypatch):
    settings = get_settings().model_copy(
        update={"google_places_api_key": "g-key", "yelp_api_key": "y-key"}
    )
    monkeypatch.setattr("app.services.reviews.get_settings", lambda: settings)
    return settings


@pytest.mark.asyncio
async def test_fetch_google_reviews_parses_payload(api_keys):
    with respx.mock:
        respx.get("https://places.googleapis.com/v1/places/g1").mock(
            return_value=Response(
                200,
                json={
                    "reviews": [
                        {
                            "text": {"text": "Amazing pad thai"},
                            "rating": 5,
                            "publishTime": "2026-05-01T10:00:00Z",
                        },
                        {"text": {"text": ""}, "rating": 4},  # dropped: empty
                    ]
                },
            )
        )
        reviews = await fetch_google_reviews("g1")

    assert len(reviews) == 1
    assert reviews[0]["source"] == "google"
    assert reviews[0]["text"] == "Amazing pad thai"
    assert reviews[0]["rating"] == 5
    assert reviews[0]["review_date"] is not None


@pytest.mark.asyncio
async def test_fetch_google_reviews_soft_fails(api_keys):
    with respx.mock:
        respx.get("https://places.googleapis.com/v1/places/g1").mock(
            return_value=Response(500)
        )
        assert await fetch_google_reviews("g1") == []


@pytest.mark.asyncio
async def test_fetch_yelp_reviews_matches_then_pulls(api_keys):
    with respx.mock:
        respx.get("https://api.yelp.com/v3/businesses/search").mock(
            return_value=Response(
                200, json={"businesses": [{"id": "yelp-biz-1"}]}
            )
        )
        respx.get("https://api.yelp.com/v3/businesses/yelp-biz-1/reviews").mock(
            return_value=Response(
                200,
                json={
                    "reviews": [
                        {
                            "text": "Great curry.",
                            "rating": 4,
                            "time_created": "2026-04-02 12:00:00",
                        }
                    ]
                },
            )
        )
        reviews = await fetch_yelp_reviews("Thai Basil", 1.0, 2.0)

    assert len(reviews) == 1
    assert reviews[0]["source"] == "yelp"
    assert reviews[0]["text"] == "Great curry."


@pytest.mark.asyncio
async def test_fetch_yelp_reviews_skips_without_key(monkeypatch):
    settings = get_settings().model_copy(update={"yelp_api_key": ""})
    monkeypatch.setattr("app.services.reviews.get_settings", lambda: settings)
    assert await fetch_yelp_reviews("X", 0.0, 0.0) == []


@pytest.mark.asyncio
async def test_store_reviews_replaces_per_source(db_session):
    restaurant = Restaurant(google_place_id="g-store", name="S", lat=0.0, lng=0.0)
    db_session.add(restaurant)
    await db_session.flush()

    await store_reviews(
        db_session,
        restaurant,
        [
            {"source": "google", "text": "old google", "rating": 3},
            {"source": "yelp", "text": "yelp stays", "rating": 4},
        ],
    )
    await store_reviews(
        db_session,
        restaurant,
        [{"source": "google", "text": "new google", "rating": 5}],
    )

    rows = (
        (
            await db_session.execute(
                select(ReviewRaw).where(ReviewRaw.restaurant_id == restaurant.id)
            )
        )
        .scalars()
        .all()
    )
    by_source = {r.source: r.text for r in rows}
    assert by_source == {"google": "new google", "yelp": "yelp stays"}
