from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ok", "db": "ok", "redis": "ok"}


@pytest.mark.asyncio
async def test_health_reports_redis_error(client: AsyncClient, monkeypatch) -> None:
    broken = AsyncMock()
    broken.ping.side_effect = ConnectionError("redis is down")
    monkeypatch.setattr("app.routers.health.get_redis", lambda: broken)

    response = await client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "error"
    assert body["db"] == "ok"
    assert body["redis"] == "error"
    # development environment may include details
    assert "redis is down" in str(body.get("errors", {}))


@pytest.mark.asyncio
async def test_health_hides_error_details_in_production(
    client: AsyncClient, monkeypatch
) -> None:
    from app.config import get_settings

    broken = AsyncMock()
    broken.ping.side_effect = ConnectionError("secret-host:6379 refused")
    monkeypatch.setattr("app.routers.health.get_redis", lambda: broken)
    monkeypatch.setattr(
        "app.routers.health.get_settings",
        lambda: get_settings().model_copy(update={"environment": "production"}),
    )

    response = await client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert "errors" not in body
    assert "secret-host" not in response.text
