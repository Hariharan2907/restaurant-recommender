import json
from unittest.mock import AsyncMock

import pytest

from app.jobs import (
    JOB_EXTRACT_DISHES,
    JOB_FETCH_REVIEWS,
    QUEUE_KEY,
    enqueue,
    enqueue_restaurant_refresh,
    run_job,
)
from app.models.restaurant import Restaurant
from app.services.reviews import reviews_fetched_marker


@pytest.mark.asyncio
async def test_enqueue_pushes_json(shared_fake_redis):
    assert await enqueue(JOB_FETCH_REVIEWS, {"restaurant_id": "abc"}) is True
    raw = await shared_fake_redis.rpop(QUEUE_KEY)
    assert json.loads(raw) == {
        "type": JOB_FETCH_REVIEWS,
        "payload": {"restaurant_id": "abc"},
    }


@pytest.mark.asyncio
async def test_enqueue_restaurant_refresh_respects_30d_marker(shared_fake_redis):
    await shared_fake_redis.set(reviews_fetched_marker("recent-id"), "1")
    await enqueue_restaurant_refresh("recent-id")
    assert await shared_fake_redis.llen(QUEUE_KEY) == 0

    await enqueue_restaurant_refresh("stale-id")
    assert await shared_fake_redis.llen(QUEUE_KEY) == 1


@pytest.mark.asyncio
async def test_run_job_malformed_payload_returns_false(db_session):
    assert await run_job(db_session, "not json") is False
    assert await run_job(db_session, json.dumps({"type": "nope", "payload": {}})) is False


@pytest.mark.asyncio
async def test_fetch_reviews_job_stores_marks_and_chains(
    db_session, shared_fake_redis, monkeypatch
):
    restaurant = Restaurant(google_place_id="g-job", name="J", lat=1.0, lng=2.0)
    db_session.add(restaurant)
    await db_session.flush()

    monkeypatch.setattr(
        "app.services.reviews.fetch_google_reviews",
        AsyncMock(return_value=[{"source": "google", "text": "nice", "rating": 5}]),
    )
    monkeypatch.setattr(
        "app.services.reviews.fetch_yelp_reviews", AsyncMock(return_value=[])
    )

    raw = json.dumps(
        {
            "type": JOB_FETCH_REVIEWS,
            "payload": {"restaurant_id": str(restaurant.id)},
        }
    )
    assert await run_job(db_session, raw) is True

    # 30-day marker set
    assert await shared_fake_redis.get(reviews_fetched_marker(str(restaurant.id)))
    # chained extract_dishes job enqueued
    queued = json.loads(await shared_fake_redis.rpop(QUEUE_KEY))
    assert queued["type"] == JOB_EXTRACT_DISHES
    assert queued["payload"]["restaurant_id"] == str(restaurant.id)


@pytest.mark.asyncio
async def test_extract_dishes_job_refreshes_embedding(
    db_session, monkeypatch
):
    restaurant = Restaurant(google_place_id="g-job2", name="J2", lat=1.0, lng=2.0)
    db_session.add(restaurant)
    await db_session.flush()

    extract = AsyncMock(return_value=3)
    embed = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.dish_extraction.extract_dishes", extract)
    monkeypatch.setattr(
        "app.services.embeddings.ensure_restaurant_embedding", embed
    )

    raw = json.dumps(
        {
            "type": JOB_EXTRACT_DISHES,
            "payload": {"restaurant_id": str(restaurant.id)},
        }
    )
    assert await run_job(db_session, raw) is True
    extract.assert_awaited_once()
    embed.assert_awaited_once()
    assert embed.await_args.kwargs.get("force") is True
