import json

import pytest
import respx
import httpx
from fakeredis.aioredis import FakeRedis

from app.services.places import find_places


@pytest.fixture
def fake_redis():
    return FakeRedis(decode_responses=True)


@pytest.mark.asyncio
@respx.mock
async def test_find_places_calls_google_on_cache_miss(monkeypatch, fake_redis, load_fixture):
    # Patch at the service-module level because find_places imports get_redis and
    # get_settings into its own namespace via `from ... import ...`.
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.services.places.get_settings", lambda: _settings_with_key("places-key"))

    body = load_fixture("places_indian_sf.json")
    route = respx.post("https://places.googleapis.com/v1/places:searchText").mock(
        return_value=httpx.Response(200, json=body)
    )

    results = await find_places("indian", 37.785, -122.409, 3000)

    assert route.called
    assert len(results) == 2
    assert results[0].google_place_id == "ChIJplaceA"
    assert results[0].name == "Curry House"
    assert results[0].rating == 4.4
    assert results[0].price_tier == 2  # MODERATE → 2


@pytest.mark.asyncio
@respx.mock
async def test_find_places_restricts_search_to_restaurants(monkeypatch, fake_redis, load_fixture):
    # Regression: a bare cuisine like "indian" used to match the COUNTRY "India" because
    # the request put no type restriction on searchText (locationBias is only a soft hint).
    # The request must pin results to restaurants so geography can't outrank eateries.
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.services.places.get_settings", lambda: _settings_with_key("places-key"))

    body = load_fixture("places_indian_sf.json")
    route = respx.post("https://places.googleapis.com/v1/places:searchText").mock(
        return_value=httpx.Response(200, json=body)
    )

    await find_places("indian", 37.785, -122.409, 3000)

    sent = json.loads(route.calls.last.request.content)
    assert sent.get("includedType") == "restaurant"


@pytest.mark.asyncio
@respx.mock
async def test_find_places_uses_cache_on_second_call(monkeypatch, fake_redis, load_fixture):
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.services.places.get_settings", lambda: _settings_with_key("places-key"))

    body = load_fixture("places_indian_sf.json")
    route = respx.post("https://places.googleapis.com/v1/places:searchText").mock(
        return_value=httpx.Response(200, json=body)
    )

    await find_places("indian", 37.785, -122.409, 3000)
    await find_places("indian", 37.785, -122.409, 3000)

    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_find_places_quantizes_coords_into_same_cache_key(monkeypatch, fake_redis, load_fixture):
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.services.places.get_settings", lambda: _settings_with_key("places-key"))

    body = load_fixture("places_indian_sf.json")
    route = respx.post("https://places.googleapis.com/v1/places:searchText").mock(
        return_value=httpx.Response(200, json=body)
    )

    # 37.7851 and 37.7854 both quantize to 37.785; -122.4091 and -122.4094 both → -122.409
    await find_places("indian", 37.7851, -122.4091, 3000)
    await find_places("indian", 37.7854, -122.4094, 3000)

    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_find_places_raises_on_5xx(monkeypatch, fake_redis):
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.services.places.get_settings", lambda: _settings_with_key("places-key"))

    respx.post("https://places.googleapis.com/v1/places:searchText").mock(
        return_value=httpx.Response(503)
    )

    with pytest.raises(httpx.HTTPStatusError):
        await find_places("indian", 37.785, -122.409, 3000)


def _settings_with_key(key: str):
    """Helper: a Settings-like object with just the fields find_places reads."""
    from app.config import Settings
    return Settings(
        google_places_api_key=key,
        google_places_url="https://places.googleapis.com/v1/places:searchText",
        google_places_timeout_s=5.0,
        places_cache_ttl_s=604800,
    )
