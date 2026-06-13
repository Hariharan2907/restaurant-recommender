from unittest.mock import AsyncMock

import pytest
from fakeredis.aioredis import FakeRedis

from app.schemas.search import ParsedFilters, RestaurantResult


@pytest.fixture
def fake_redis():
    return FakeRedis(decode_responses=True)


@pytest.mark.asyncio
async def test_search_happy_path_returns_results_and_parsed_filters(monkeypatch, client, fake_redis):
    monkeypatch.setattr("app.routers.search.get_redis", lambda: fake_redis)
    monkeypatch.setattr(
        "app.routers.search.parse_query",
        AsyncMock(return_value=ParsedFilters(cuisine="indian", min_rating=4.0)),
    )
    monkeypatch.setattr(
        "app.routers.search.find_places",
        AsyncMock(return_value=[
            RestaurantResult(google_place_id="g1", name="A", rating=4.5, lat=0.0, lng=0.0),
            RestaurantResult(google_place_id="g2", name="B", rating=3.0, lat=0.0, lng=0.0),
        ]),
    )
    monkeypatch.setattr("app.routers.search.upsert_many", AsyncMock())

    resp = await client.post("/search", json={
        "query": "cozy indian 4 stars",
        "lat": 37.785,
        "lng": -122.409,
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["parsed_filters"]["cuisine"] == "indian"
    # min_rating=4.0 should drop "B" (rating 3.0)
    assert [r["google_place_id"] for r in body["results"]] == ["g1"]
    assert body["cached"] is False


@pytest.mark.asyncio
async def test_search_returns_cached_on_repeat(monkeypatch, client, fake_redis):
    monkeypatch.setattr("app.routers.search.get_redis", lambda: fake_redis)
    parse_mock = AsyncMock(return_value=ParsedFilters(cuisine="ramen"))
    places_mock = AsyncMock(return_value=[
        RestaurantResult(google_place_id="g1", name="A", rating=4.5, lat=0.0, lng=0.0),
    ])
    monkeypatch.setattr("app.routers.search.parse_query", parse_mock)
    monkeypatch.setattr("app.routers.search.find_places", places_mock)
    monkeypatch.setattr("app.routers.search.upsert_many", AsyncMock())

    body = {"query": "ramen", "lat": 37.785, "lng": -122.409}
    r1 = await client.post("/search", json=body)
    r2 = await client.post("/search", json=body)

    assert r1.json()["cached"] is False
    assert r2.json()["cached"] is True
    # downstream services only called once
    assert parse_mock.call_count == 1
    assert places_mock.call_count == 1


@pytest.mark.asyncio
async def test_search_returns_502_when_places_errors(monkeypatch, client, fake_redis):
    import httpx
    monkeypatch.setattr("app.routers.search.get_redis", lambda: fake_redis)
    monkeypatch.setattr(
        "app.routers.search.parse_query",
        AsyncMock(return_value=ParsedFilters()),
    )
    monkeypatch.setattr(
        "app.routers.search.find_places",
        AsyncMock(side_effect=httpx.HTTPStatusError(
            "503", request=httpx.Request("POST", "http://x"), response=httpx.Response(503),
        )),
    )
    monkeypatch.setattr("app.routers.search.upsert_many", AsyncMock())

    resp = await client.post("/search", json={
        "query": "anything", "lat": 0.0, "lng": 0.0,
    })

    assert resp.status_code == 502
    assert resp.json() == {"detail": "places_error"}


@pytest.mark.asyncio
async def test_search_swallows_upsert_failure(monkeypatch, client, fake_redis):
    monkeypatch.setattr("app.routers.search.get_redis", lambda: fake_redis)
    monkeypatch.setattr(
        "app.routers.search.parse_query",
        AsyncMock(return_value=ParsedFilters()),
    )
    monkeypatch.setattr(
        "app.routers.search.find_places",
        AsyncMock(return_value=[
            RestaurantResult(google_place_id="g1", name="A", lat=0.0, lng=0.0),
        ]),
    )
    monkeypatch.setattr(
        "app.routers.search.upsert_many",
        AsyncMock(side_effect=RuntimeError("db down")),
    )

    resp = await client.post("/search", json={
        "query": "anything", "lat": 0.0, "lng": 0.0,
    })

    assert resp.status_code == 200
    assert resp.json()["results"][0]["google_place_id"] == "g1"
