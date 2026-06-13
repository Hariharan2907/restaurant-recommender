import pytest


@pytest.mark.asyncio
async def test_security_headers_present(client):
    r = await client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer"
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_oversized_request_rejected_413(client):
    huge_query = "x" * (70 * 1024)  # > 64 KiB limit
    r = await client.post(
        "/search", json={"query": huge_query, "lat": 1.0, "lng": 2.0}
    )
    assert r.status_code == 413
    assert r.json() == {"detail": "request_too_large"}


@pytest.mark.asyncio
async def test_unhandled_errors_do_not_leak_details(client, monkeypatch):
    def boom():
        raise RuntimeError("secret connection string leak")

    monkeypatch.setattr("app.routers.search.get_redis", boom)

    r = await client.post(
        "/search", json={"query": "ramen", "lat": 1.0, "lng": 2.0}
    )
    assert r.status_code == 500
    assert r.json() == {"detail": "internal_error"}
    assert "secret" not in r.text
