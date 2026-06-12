from unittest.mock import AsyncMock

import pytest

from app.config import get_settings
from app.schemas.search import ParsedFilters


@pytest.fixture(autouse=True)
def tight_limits(monkeypatch):
    settings = get_settings().model_copy(
        update={
            "rate_limit_enabled": True,
            "rate_limit_search_user_per_min": 2,
            "rate_limit_search_ip_per_min": 3,
        }
    )
    monkeypatch.setattr("app.ratelimit.get_settings", lambda: settings)
    return settings


@pytest.fixture
def stubbed_search(monkeypatch, shared_fake_redis):
    """Stub the search pipeline so requests are cheap; reuse fake redis for cache."""
    from fakeredis.aioredis import FakeRedis

    monkeypatch.setattr(
        "app.routers.search.get_redis", lambda: FakeRedis(decode_responses=True)
    )
    monkeypatch.setattr(
        "app.routers.search.parse_query", AsyncMock(return_value=ParsedFilters())
    )
    monkeypatch.setattr("app.routers.search.find_places", AsyncMock(return_value=[]))
    monkeypatch.setattr("app.routers.search.upsert_many", AsyncMock())


@pytest.mark.asyncio
async def test_search_rate_limited_per_ip(client, stubbed_search):
    body = {"query": "ramen", "lat": 1.0, "lng": 2.0}
    statuses = []
    for i in range(4):
        # vary the query to dodge the response cache, not the rate limiter
        r = await client.post("/search", json={**body, "query": f"ramen {i}"})
        statuses.append(r.status_code)

    assert statuses[:3] == [200, 200, 200]
    assert statuses[3] == 429
    assert "Retry-After" in (await client.post("/search", json=body)).headers


@pytest.mark.asyncio
async def test_rate_limit_disabled_allows_all(client, stubbed_search, monkeypatch):
    settings = get_settings().model_copy(update={"rate_limit_enabled": False})
    monkeypatch.setattr("app.ratelimit.get_settings", lambda: settings)

    for i in range(6):
        r = await client.post(
            "/search", json={"query": f"q{i}", "lat": 1.0, "lng": 2.0}
        )
        assert r.status_code == 200


@pytest.mark.asyncio
async def test_rate_limit_fails_open_when_redis_down(client, stubbed_search, monkeypatch):
    broken = AsyncMock()
    broken.incr.side_effect = ConnectionError("redis down")
    monkeypatch.setattr("app.ratelimit.get_redis", lambda: broken)

    for i in range(5):
        r = await client.post(
            "/search", json={"query": f"q{i}", "lat": 1.0, "lng": 2.0}
        )
        assert r.status_code == 200
