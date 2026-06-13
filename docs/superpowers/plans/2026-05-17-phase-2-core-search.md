# Phase 2 — Core Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `POST /search` end-to-end — natural-language query → Claude Haiku parse → Google Places lookup → Postgres upsert + Redis cache → mobile renders results + parsed-filter chips.

**Architecture:** Linear pipeline in a single FastAPI router (`routers/search.py`) calling typed async helpers in `app/services/`. Two-layer Redis cache (response 10min, candidates 7d). Mobile reads device GPS via `expo-location`, hits backend via the existing `apiFetch` helper.

**Tech Stack:** FastAPI · SQLAlchemy 2 async · psycopg3 · Anthropic SDK (claude-3-5-haiku) · Google Places v1 `searchText` · redis-py + fakeredis · httpx + respx · Expo SDK 54 + expo-location · React Native FlatList.

**Spec:** `docs/superpowers/specs/2026-05-17-phase-2-core-search-design.md`

**Branch:** `phase-2-core-search` (off `main`, spec already committed).

---

## File map

**Backend — new files**
- `backend/app/cache.py` — Redis client singleton, key helpers
- `backend/app/llm.py` — Anthropic client singleton
- `backend/app/schemas/search.py` — Pydantic models
- `backend/app/services/__init__.py`
- `backend/app/services/filters.py` — pure `apply_filters`
- `backend/app/services/parse.py` — `parse_query` (Claude Haiku)
- `backend/app/services/places.py` — `find_places` (Google Places v1) + `PlaceRaw`
- `backend/app/services/restaurants.py` — `upsert_many`
- `backend/app/routers/search.py` — `POST /search`
- `backend/tests/fixtures/places_indian_sf.json`
- `backend/tests/fixtures/claude_parse_indian.json`
- `backend/tests/test_filters.py`
- `backend/tests/test_parse.py`
- `backend/tests/test_places.py`
- `backend/tests/test_restaurants.py`
- `backend/tests/test_search_router.py`
- `mobile/lib/location.ts`
- `mobile/lib/search.ts`
- `mobile/components/FilterChips.tsx`
- `mobile/components/ResultsList.tsx`

**Backend — modified files**
- `backend/requirements.txt` — add `anthropic`, `redis`, `httpx` (already in dev), promote `httpx` to runtime
- `backend/requirements-dev.txt` — add `fakeredis`, `respx`
- `backend/app/config.py` — add `anthropic_model`, `google_places_url` config knobs (optional defaults)
- `backend/app/main.py` — register `search` router
- `backend/tests/conftest.py` — add fixtures: `db_session`, `fake_redis`, `mock_anthropic`, `mock_httpx`

**Mobile — modified files**
- `mobile/package.json` — add `expo-location`
- `mobile/app/(tabs)/index.tsx` — wire `onSubmitEditing` + CTA → `search()`

---

## Task 1: Add backend dependencies

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/requirements-dev.txt`

- [ ] **Step 1: Edit `backend/requirements.txt`**

Final content:
```
fastapi==0.115.6
uvicorn[standard]==0.32.1
sqlalchemy[asyncio]==2.0.36
psycopg[binary,pool]==3.2.3
alembic==1.14.0
pgvector==0.3.6
pydantic==2.10.3
pydantic-settings==2.6.1
anthropic==0.40.0
redis==5.2.1
httpx==0.28.1
```

- [ ] **Step 2: Edit `backend/requirements-dev.txt`**

Final content:
```
-r requirements.txt
pytest==8.3.4
pytest-asyncio==0.24.0
fakeredis==2.26.1
respx==0.22.0
```

- [ ] **Step 3: Install**

```bash
cd backend && pip install -r requirements-dev.txt
```
Expected: no errors.

- [ ] **Step 4: Verify existing tests still pass**

```bash
cd backend && pytest -v
```
Expected: `test_health_ok PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt
git commit -m "Phase 2: add anthropic, redis, httpx, fakeredis, respx deps"
```

---

## Task 2: Add config knobs for new services

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Edit `backend/app/config.py` to add new fields**

Add inside the `Settings` class (after `yelp_api_key`):

```python
    anthropic_model: str = Field(default="claude-3-5-haiku-20241022")
    google_places_url: str = Field(
        default="https://places.googleapis.com/v1/places:searchText"
    )
    anthropic_timeout_s: float = Field(default=3.0)
    google_places_timeout_s: float = Field(default=5.0)
    search_cache_ttl_s: int = Field(default=600)        # 10 min
    places_cache_ttl_s: int = Field(default=604800)     # 7 days
```

- [ ] **Step 2: Verify config loads**

```bash
cd backend && python -c "from app.config import get_settings; s = get_settings(); print(s.anthropic_model, s.search_cache_ttl_s)"
```
Expected output: `claude-3-5-haiku-20241022 600`

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "Phase 2: add config knobs for anthropic + places + cache TTLs"
```

---

## Task 3: Pydantic schemas for /search

**Files:**
- Create: `backend/app/schemas/search.py`

(No tests — these are declarations; they will be exercised by every downstream test.)

- [ ] **Step 1: Create `backend/app/schemas/search.py`**

```python
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    radius_m: int = Field(default=3000, ge=100, le=20000)


class ParsedFilters(BaseModel):
    cuisine: str | None = None
    min_rating: float | None = Field(default=None, ge=0.0, le=5.0)
    vibe_tags: list[str] = Field(default_factory=list)
    dietary: list[str] = Field(default_factory=list)
    price_max: int | None = Field(default=None, ge=1, le=4)
    intent: str | None = None


class RestaurantResult(BaseModel):
    google_place_id: str
    name: str
    cuisine: str | None = None
    rating: float | None = None
    price_tier: int | None = None
    lat: float
    lng: float
    address: str | None = None
    photo_url: str | None = None
    distance_m: int | None = None


class SearchResponse(BaseModel):
    parsed_filters: ParsedFilters
    results: list[RestaurantResult]
    cached: bool
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python -c "from app.schemas.search import SearchRequest, ParsedFilters, RestaurantResult, SearchResponse; print('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/search.py
git commit -m "Phase 2: add search Pydantic schemas"
```

---

## Task 4: Redis client + cache key helpers

**Files:**
- Create: `backend/app/cache.py`
- Create: `backend/tests/test_cache.py`

- [ ] **Step 1: Write failing test `backend/tests/test_cache.py`**

```python
from app.cache import quantize_coord, search_key, places_key


def test_quantize_coord_3_decimals():
    assert quantize_coord(40.12345) == 40.123
    assert quantize_coord(40.12389) == 40.124
    assert quantize_coord(-122.41999) == -122.420


def test_search_key_normalizes_query_case_and_whitespace():
    a = search_key("  Cozy Ramen  ", 40.1234, -122.4198, 3000)
    b = search_key("cozy ramen", 40.1234, -122.4199, 3000)
    assert a == b


def test_search_key_differs_when_radius_differs():
    a = search_key("cozy ramen", 40.1234, -122.4198, 3000)
    b = search_key("cozy ramen", 40.1234, -122.4198, 5000)
    assert a != b


def test_places_key_uses_quantized_coords():
    a = places_key("indian", 40.1234, -122.4198, 3000)
    b = places_key("indian", 40.1238, -122.4201, 3000)
    # both quantize to 40.124 / -122.420
    assert a == b


def test_places_key_differs_for_different_cuisine():
    a = places_key("indian", 40.1234, -122.4198, 3000)
    b = places_key("thai", 40.1234, -122.4198, 3000)
    assert a != b
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_cache.py -v
```
Expected: ImportError / ModuleNotFoundError on `app.cache`.

- [ ] **Step 3: Create `backend/app/cache.py`**

```python
import hashlib
from functools import lru_cache

import redis.asyncio as redis_asyncio

from app.config import get_settings


def quantize_coord(value: float) -> float:
    """Round to 3 decimals (~100m grid) for cache-key bucketing."""
    return round(value, 3)


def _hash(parts: list[str]) -> str:
    joined = "|".join(parts)
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()


def search_key(query: str, lat: float, lng: float, radius_m: int) -> str:
    normalized = query.strip().lower()
    digest = _hash([
        normalized,
        f"{quantize_coord(lat)}",
        f"{quantize_coord(lng)}",
        str(radius_m),
    ])
    return f"search:{digest}"


def places_key(text_query: str, lat: float, lng: float, radius_m: int) -> str:
    normalized = text_query.strip().lower()
    digest = _hash([
        normalized,
        f"{quantize_coord(lat)}",
        f"{quantize_coord(lng)}",
        str(radius_m),
    ])
    return f"places:{digest}"


@lru_cache(maxsize=1)
def get_redis() -> redis_asyncio.Redis:
    settings = get_settings()
    return redis_asyncio.from_url(
        settings.redis_url,
        decode_responses=True,
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_cache.py -v
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/cache.py backend/tests/test_cache.py
git commit -m "Phase 2: add Redis client + cache key helpers"
```

---

## Task 5: Anthropic client singleton

**Files:**
- Create: `backend/app/llm.py`
- Create: `backend/tests/test_llm.py`

- [ ] **Step 1: Write failing test `backend/tests/test_llm.py`**

```python
from app.config import get_settings
from app.llm import get_anthropic_client


def test_get_anthropic_client_returns_cached_instance_when_key_set(monkeypatch):
    get_anthropic_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-key")

    a = get_anthropic_client()
    b = get_anthropic_client()
    assert a is not None
    assert a is b

    get_anthropic_client.cache_clear()
    get_settings.cache_clear()


def test_get_anthropic_client_returns_none_when_no_key(monkeypatch):
    get_anthropic_client.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")

    assert get_anthropic_client() is None

    get_anthropic_client.cache_clear()
    get_settings.cache_clear()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_llm.py -v
```
Expected: ImportError.

- [ ] **Step 3: Create `backend/app/llm.py`**

```python
from functools import lru_cache

from anthropic import AsyncAnthropic

from app.config import get_settings


@lru_cache(maxsize=1)
def get_anthropic_client() -> AsyncAnthropic | None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    return AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.anthropic_timeout_s,
    )
```

- [ ] **Step 4: Run test**

```bash
cd backend && pytest tests/test_llm.py -v
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/llm.py backend/tests/test_llm.py
git commit -m "Phase 2: add Anthropic client singleton"
```

---

## Task 6: services/filters.py — pure filter logic

**Files:**
- Create: `backend/app/services/__init__.py` (empty)
- Create: `backend/app/services/filters.py`
- Create: `backend/tests/test_filters.py`

`filters.py` operates on `RestaurantResult` (already typed with the fields it needs). The function is pure — no I/O.

- [ ] **Step 1: Create empty `backend/app/services/__init__.py`**

```python
```

- [ ] **Step 2: Write failing test `backend/tests/test_filters.py`**

```python
from app.schemas.search import ParsedFilters, RestaurantResult
from app.services.filters import apply_filters


def _r(name: str, rating: float | None = None, price: int | None = None) -> RestaurantResult:
    return RestaurantResult(
        google_place_id=f"g-{name}",
        name=name,
        rating=rating,
        price_tier=price,
        lat=0.0,
        lng=0.0,
    )


def test_empty_filters_passes_everything_through():
    places = [_r("A", rating=3.0), _r("B", rating=4.5)]
    out = apply_filters(places, ParsedFilters())
    assert {p.name for p in out} == {"A", "B"}


def test_min_rating_drops_below_threshold():
    places = [_r("A", rating=3.0), _r("B", rating=4.5), _r("C", rating=None)]
    out = apply_filters(places, ParsedFilters(min_rating=4.0))
    # None rating fails the filter (we don't trust unknown ratings)
    assert {p.name for p in out} == {"B"}


def test_price_max_drops_above_threshold():
    places = [_r("A", price=1), _r("B", price=3), _r("C", price=None)]
    out = apply_filters(places, ParsedFilters(price_max=2))
    # None price passes (we don't have info to reject it)
    assert {p.name for p in out} == {"A", "C"}


def test_rating_at_boundary_passes():
    places = [_r("A", rating=4.0)]
    out = apply_filters(places, ParsedFilters(min_rating=4.0))
    assert len(out) == 1
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_filters.py -v
```
Expected: ImportError on `app.services.filters`.

- [ ] **Step 4: Create `backend/app/services/filters.py`**

```python
from app.schemas.search import ParsedFilters, RestaurantResult


def apply_filters(
    places: list[RestaurantResult],
    filters: ParsedFilters,
) -> list[RestaurantResult]:
    out: list[RestaurantResult] = []
    for p in places:
        if filters.min_rating is not None:
            if p.rating is None or p.rating < filters.min_rating:
                continue
        if filters.price_max is not None:
            if p.price_tier is not None and p.price_tier > filters.price_max:
                continue
        # dietary filters are not derivable from Google Places fields in Phase 2;
        # we keep the filter declared in the schema for forward-compat but don't
        # apply it here. Phase 4 will populate dietary_flags from review extraction.
        out.append(p)
    return out
```

- [ ] **Step 5: Run test**

```bash
cd backend && pytest tests/test_filters.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/__init__.py backend/app/services/filters.py backend/tests/test_filters.py
git commit -m "Phase 2: add apply_filters service + tests"
```

---

## Task 7: services/parse.py — Claude Haiku query parsing

**Files:**
- Create: `backend/app/services/parse.py`
- Create: `backend/tests/fixtures/claude_parse_indian.json`
- Create: `backend/tests/test_parse.py`
- Modify: `backend/tests/conftest.py` (add `mock_anthropic` fixture)

- [ ] **Step 1: Create fixture `backend/tests/fixtures/claude_parse_indian.json`**

```json
{
  "cuisine": "indian",
  "min_rating": 4.0,
  "vibe_tags": ["cozy"],
  "dietary": ["vegetarian"],
  "price_max": 2,
  "intent": "eat-now"
}
```

- [ ] **Step 2: Edit `backend/tests/conftest.py` to add `mock_anthropic` fixture**

Append to the existing file:

```python
from pathlib import Path
import json
import pytest


FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def load_fixture():
    def _load(name: str) -> dict:
        return json.loads((FIXTURES_DIR / name).read_text())
    return _load
```

(We will add `mock_anthropic` and `mock_httpx` fixtures inline in the test modules — simpler than a global fixture for one-off mock behaviors.)

- [ ] **Step 3: Write failing test `backend/tests/test_parse.py`**

```python
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.schemas.search import ParsedFilters
from app.services.parse import parse_query


def _make_anthropic_response(payload: dict | str) -> SimpleNamespace:
    """Mimic the shape of anthropic.types.Message: .content[0].text"""
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(content=[SimpleNamespace(text=text)])


@pytest.mark.asyncio
async def test_parse_query_happy_path(monkeypatch, load_fixture):
    payload = load_fixture("claude_parse_indian.json")
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(return_value=_make_anthropic_response(payload)))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("cozy indian spot 4 stars vegetarian")
    assert result.cuisine == "indian"
    assert result.min_rating == 4.0
    assert "cozy" in result.vibe_tags
    assert "vegetarian" in result.dietary


@pytest.mark.asyncio
async def test_parse_query_returns_empty_on_invalid_json(monkeypatch):
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(return_value=_make_anthropic_response("not json {{{")))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("anything")
    assert result == ParsedFilters()


@pytest.mark.asyncio
async def test_parse_query_returns_empty_when_no_client(monkeypatch):
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: None)

    result = await parse_query("anything")
    assert result == ParsedFilters()


@pytest.mark.asyncio
async def test_parse_query_returns_empty_on_api_exception(monkeypatch):
    mock_client = SimpleNamespace(
        messages=SimpleNamespace(create=AsyncMock(side_effect=RuntimeError("boom")))
    )
    monkeypatch.setattr("app.services.parse.get_anthropic_client", lambda: mock_client)

    result = await parse_query("anything")
    assert result == ParsedFilters()
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd backend && pytest tests/test_parse.py -v
```
Expected: ImportError on `app.services.parse`.

- [ ] **Step 5: Create `backend/app/services/parse.py`**

```python
import json
import logging
import time

from app.config import get_settings
from app.llm import get_anthropic_client
from app.schemas.search import ParsedFilters

logger = logging.getLogger(__name__)

_PARSE_SYSTEM_PROMPT = """You convert a user's natural-language restaurant search into structured filters.

Return ONLY a JSON object with these keys (omit any that don't apply, do not invent values):
- cuisine: string | null  (e.g. "indian", "ramen", "pizza")
- min_rating: number | null  (0.0 to 5.0)
- vibe_tags: string[]  (e.g. ["cozy", "date-night", "healthy", "fast"])
- dietary: string[]  (subset of ["vegetarian", "vegan", "gluten_free"])
- price_max: integer | null  (1=$, 2=$$, 3=$$$, 4=$$$$)
- intent: string | null  ("eat-now" | "explore" | "plan-later")

Reply with the JSON only, no prose, no markdown fences."""


async def parse_query(query: str) -> ParsedFilters:
    client = get_anthropic_client()
    if client is None:
        logger.warning("parse_query: no Anthropic client configured, returning empty filters")
        return ParsedFilters()

    settings = get_settings()
    started = time.perf_counter()
    try:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=512,
            system=_PARSE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": query}],
        )
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        logger.warning("parse_query: anthropic call failed: %s", exc)
        return ParsedFilters()

    latency_ms = int((time.perf_counter() - started) * 1000)
    raw = response.content[0].text if response.content else ""
    try:
        data = json.loads(raw)
        parsed = ParsedFilters.model_validate(data)
    except Exception as exc:  # noqa: BLE001 — soft-fail on bad LLM output
        logger.warning("parse_query: invalid JSON from model (%s): %r", exc, raw[:200])
        return ParsedFilters()

    logger.info(
        "parse_query ok model=%s latency_ms=%d query=%r parsed=%s",
        settings.anthropic_model,
        latency_ms,
        query,
        parsed.model_dump(exclude_none=True),
    )
    return parsed
```

- [ ] **Step 6: Run test**

```bash
cd backend && pytest tests/test_parse.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/parse.py backend/tests/fixtures/claude_parse_indian.json backend/tests/test_parse.py backend/tests/conftest.py
git commit -m "Phase 2: add parse_query (Claude Haiku) with soft-fail fallbacks + tests"
```

---

## Task 8: services/places.py — Google Places v1 client with caching

**Files:**
- Create: `backend/app/services/places.py`
- Create: `backend/tests/fixtures/places_indian_sf.json`
- Create: `backend/tests/test_places.py`

The Google Places v1 `searchText` endpoint takes a POST with body `{textQuery, locationBias: {circle: {center: {latitude, longitude}, radius}}}` and header `X-Goog-FieldMask: places.id,places.displayName,...`.

- [ ] **Step 1: Create fixture `backend/tests/fixtures/places_indian_sf.json`**

A trimmed two-place response. Use this exact content:

```json
{
  "places": [
    {
      "id": "ChIJplaceA",
      "displayName": {"text": "Curry House", "languageCode": "en"},
      "formattedAddress": "123 Mission St, San Francisco, CA",
      "location": {"latitude": 37.7849, "longitude": -122.4094},
      "rating": 4.4,
      "priceLevel": "PRICE_LEVEL_MODERATE"
    },
    {
      "id": "ChIJplaceB",
      "displayName": {"text": "Tandoor Lounge", "languageCode": "en"},
      "formattedAddress": "456 Market St, San Francisco, CA",
      "location": {"latitude": 37.7900, "longitude": -122.4000},
      "rating": 4.6,
      "priceLevel": "PRICE_LEVEL_EXPENSIVE"
    }
  ]
}
```

- [ ] **Step 2: Write failing test `backend/tests/test_places.py`**

```python
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
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.config.get_settings", lambda: _settings_with_key("places-key"))

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
async def test_find_places_uses_cache_on_second_call(monkeypatch, fake_redis, load_fixture):
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.config.get_settings", lambda: _settings_with_key("places-key"))

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
    monkeypatch.setattr("app.config.get_settings", lambda: _settings_with_key("places-key"))

    body = load_fixture("places_indian_sf.json")
    route = respx.post("https://places.googleapis.com/v1/places:searchText").mock(
        return_value=httpx.Response(200, json=body)
    )

    # 37.7851 and 37.7854 both quantize to 37.785; -122.4094 and -122.4096 both → -122.409
    await find_places("indian", 37.7851, -122.4094, 3000)
    await find_places("indian", 37.7854, -122.4096, 3000)

    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_find_places_raises_on_5xx(monkeypatch, fake_redis):
    monkeypatch.setattr("app.services.places.get_redis", lambda: fake_redis)
    monkeypatch.setattr("app.config.get_settings", lambda: _settings_with_key("places-key"))

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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_places.py -v
```
Expected: ImportError on `app.services.places`.

- [ ] **Step 4: Create `backend/app/services/places.py`**

```python
import json
import logging

import httpx

from app.cache import get_redis, places_key
from app.config import get_settings
from app.schemas.search import RestaurantResult

logger = logging.getLogger(__name__)

_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.priceLevel",
])

_PRICE_LEVEL_MAP = {
    "PRICE_LEVEL_FREE": 1,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


def _parse_place(raw: dict, cuisine_hint: str | None) -> RestaurantResult | None:
    place_id = raw.get("id")
    name = (raw.get("displayName") or {}).get("text")
    loc = raw.get("location") or {}
    lat = loc.get("latitude")
    lng = loc.get("longitude")
    if not (place_id and name and lat is not None and lng is not None):
        return None
    return RestaurantResult(
        google_place_id=place_id,
        name=name,
        cuisine=cuisine_hint,
        rating=raw.get("rating"),
        price_tier=_PRICE_LEVEL_MAP.get(raw.get("priceLevel", "")),
        lat=lat,
        lng=lng,
        address=raw.get("formattedAddress"),
        photo_url=None,
    )


async def find_places(
    text_query: str,
    lat: float,
    lng: float,
    radius_m: int,
) -> list[RestaurantResult]:
    settings = get_settings()
    redis = get_redis()
    key = places_key(text_query, lat, lng, radius_m)

    cached = await redis.get(key)
    if cached is not None:
        logger.info("find_places cache HIT key=%s", key)
        data = json.loads(cached)
        return [RestaurantResult(**item) for item in data]

    if not settings.google_places_api_key:
        logger.warning("find_places: no Google Places API key configured")
        return []

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": _FIELD_MASK,
    }
    body = {
        "textQuery": text_query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius_m),
            }
        },
    }

    async with httpx.AsyncClient(timeout=settings.google_places_timeout_s) as client:
        resp = await client.post(settings.google_places_url, headers=headers, json=body)
        resp.raise_for_status()
        payload = resp.json()

    parsed: list[RestaurantResult] = []
    for raw in payload.get("places", []):
        result = _parse_place(raw, cuisine_hint=text_query)
        if result is not None:
            parsed.append(result)

    await redis.setex(
        key,
        settings.places_cache_ttl_s,
        json.dumps([r.model_dump() for r in parsed]),
    )
    logger.info("find_places cache MISS key=%s count=%d", key, len(parsed))
    return parsed
```

- [ ] **Step 5: Run test**

```bash
cd backend && pytest tests/test_places.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/places.py backend/tests/fixtures/places_indian_sf.json backend/tests/test_places.py
git commit -m "Phase 2: add find_places (Google Places v1) with 7-day Redis cache + tests"
```

---

## Task 9: services/restaurants.py — upsert_many

**Files:**
- Create: `backend/app/services/restaurants.py`
- Create: `backend/tests/test_restaurants.py`
- Modify: `backend/tests/conftest.py` (add `db_session` fixture using real Postgres)

This task needs a real Postgres. The developer must have `make up` running and have applied migrations.

- [ ] **Step 1: Edit `backend/tests/conftest.py` to add `db_session` fixture**

Append:

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import engine


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Per-test DB session inside a transaction that always rolls back.

    Requires `make up` and `alembic upgrade head` to have been run.
    """
    async with engine.connect() as conn:
        trans = await conn.begin()
        async_session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield async_session
        finally:
            await async_session.close()
            await trans.rollback()
```

(`AsyncIterator` is already imported at the top of the existing conftest.py.)

- [ ] **Step 2: Write failing test `backend/tests/test_restaurants.py`**

```python
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_restaurants.py -v
```
Expected: ImportError on `app.services.restaurants`.

- [ ] **Step 4: Create `backend/app/services/restaurants.py`**

```python
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
```

- [ ] **Step 5: Ensure Postgres is up and migrations applied, then run test**

```bash
make up && cd backend && alembic upgrade head && pytest tests/test_restaurants.py -v
```
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/restaurants.py backend/tests/test_restaurants.py backend/tests/conftest.py
git commit -m "Phase 2: add upsert_many (INSERT ON CONFLICT) for restaurants + tests"
```

---

## Task 10: routers/search.py — POST /search

**Files:**
- Create: `backend/app/routers/search.py`
- Create: `backend/tests/test_search_router.py`

- [ ] **Step 1: Write failing test `backend/tests/test_search_router.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_search_router.py -v
```
Expected: 404 (route not registered) or import errors.

- [ ] **Step 3: Create `backend/app/routers/search.py`**

```python
import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis, search_key
from app.config import get_settings
from app.db import get_session
from app.schemas.search import SearchRequest, SearchResponse
from app.services.filters import apply_filters
from app.services.parse import parse_query
from app.services.places import find_places
from app.services.restaurants import upsert_many

logger = logging.getLogger(__name__)
router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(
    req: SearchRequest,
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    settings = get_settings()
    redis = get_redis()
    key = search_key(req.query, req.lat, req.lng, req.radius_m)

    cached = await redis.get(key)
    if cached is not None:
        data = json.loads(cached)
        data["cached"] = True
        return SearchResponse(**data)

    parsed = await parse_query(req.query)
    text_query = parsed.cuisine or req.query

    try:
        candidates = await find_places(text_query, req.lat, req.lng, req.radius_m)
    except httpx.HTTPError as exc:
        logger.error("search: places lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="places_error") from exc

    filtered = apply_filters(candidates, parsed)

    try:
        await upsert_many(session, filtered)
        await session.commit()
    except Exception as exc:  # noqa: BLE001 — never block user on side-effect
        logger.error("search: upsert_many failed (swallowing): %s", exc)
        await session.rollback()

    response = SearchResponse(parsed_filters=parsed, results=filtered, cached=False)
    await redis.setex(
        key,
        settings.search_cache_ttl_s,
        response.model_dump_json(),
    )
    return response
```

- [ ] **Step 4: Register router in `backend/app/main.py`**

Modify `backend/app/main.py` to import and include the new router:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, search

settings = get_settings()

app = FastAPI(
    title="Restaurant Recommender API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(search.router)
```

- [ ] **Step 5: Run tests**

```bash
cd backend && pytest tests/test_search_router.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 6: Run full backend suite**

```bash
cd backend && pytest -v
```
Expected: all tests PASS (test_cache, test_llm, test_filters, test_parse, test_places, test_restaurants, test_search_router, test_health).

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/search.py backend/app/main.py backend/tests/test_search_router.py
git commit -m "Phase 2: add POST /search router wiring parse + places + filter + upsert + cache"
```

---

## Task 11: Install expo-location

**Files:**
- Modify: `mobile/package.json` (via `npx expo install`)

- [ ] **Step 1: Install**

```bash
cd mobile && npx expo install expo-location
```
Expected: package added, `npm install` runs, no peer-dep errors.

- [ ] **Step 2: Verify typecheck still passes**

```bash
cd mobile && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "Phase 2: add expo-location for device GPS"
```

---

## Task 12: mobile/lib/location.ts — permission + position helper

**Files:**
- Create: `mobile/lib/location.ts`

No automated tests in Phase 2 for this file (it wraps an Expo API; would need mocking expo-location which is more setup than the file is worth).

- [ ] **Step 1: Create `mobile/lib/location.ts`**

```ts
import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

export type LocationResult =
  | { kind: 'ok'; coords: Coords }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

export async function getDeviceLocation(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { kind: 'denied' };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      kind: 'ok',
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd mobile && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/location.ts
git commit -m "Phase 2: add getDeviceLocation wrapper for expo-location"
```

---

## Task 13: mobile/lib/search.ts — typed search client

**Files:**
- Create: `mobile/lib/search.ts`

- [ ] **Step 1: Create `mobile/lib/search.ts`**

```ts
import { API_BASE } from './api';
import type { Coords } from './location';

export type ParsedFilters = {
  cuisine: string | null;
  min_rating: number | null;
  vibe_tags: string[];
  dietary: string[];
  price_max: number | null;
  intent: string | null;
};

export type RestaurantResult = {
  google_place_id: string;
  name: string;
  cuisine: string | null;
  rating: number | null;
  price_tier: number | null;
  lat: number;
  lng: number;
  address: string | null;
  photo_url: string | null;
  distance_m: number | null;
};

export type SearchResponse = {
  parsed_filters: ParsedFilters;
  results: RestaurantResult[];
  cached: boolean;
};

export async function search(query: string, loc: Coords): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, lat: loc.lat, lng: loc.lng }),
  });
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  return res.json();
}
```

- [ ] **Step 2: Typecheck**

```bash
cd mobile && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/search.ts
git commit -m "Phase 2: add typed search() client"
```

---

## Task 14: mobile/components/FilterChips.tsx

**Files:**
- Create: `mobile/components/FilterChips.tsx`

Renders the echoed `parsed_filters` as small dark pills. Renders nothing if all fields are empty.

- [ ] **Step 1: Create `mobile/components/FilterChips.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';
import type { ParsedFilters } from '@/lib/search';

export function FilterChips({ filters }: { filters: ParsedFilters }) {
  const chips: string[] = [];
  if (filters.cuisine) chips.push(filters.cuisine);
  if (filters.min_rating != null) chips.push(`${filters.min_rating.toFixed(1)}★`);
  if (filters.price_max != null) chips.push('$'.repeat(filters.price_max));
  for (const tag of filters.vibe_tags) chips.push(tag);
  for (const diet of filters.dietary) chips.push(diet);

  if (chips.length === 0) return null;

  return (
    <View style={styles.row}>
      {chips.map((label) => (
        <View key={label} style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.sm,
  },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.chipBg ?? 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipText: {
    ...type.label,
    color: colors.textOnDark,
  },
});
```

> **Note:** If `colors.chipBg` is not defined in `mobile/lib/theme.ts`, the `??` fallback renders correctly. Optionally add `chipBg: 'rgba(255,255,255,0.08)'` to the `colors` export in `theme.ts` for a single source of truth — defer if you'd rather not touch that file in this task.

- [ ] **Step 2: Typecheck**

```bash
cd mobile && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/FilterChips.tsx
git commit -m "Phase 2: add FilterChips component (echo of parsed filters)"
```

---

## Task 15: mobile/components/ResultsList.tsx

**Files:**
- Create: `mobile/components/ResultsList.tsx`

A FlatList of restaurant cards in the dark-hero style.

- [ ] **Step 1: Create `mobile/components/ResultsList.tsx`**

```tsx
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '@/lib/theme';
import type { RestaurantResult } from '@/lib/search';

export function ResultsList({ results }: { results: RestaurantResult[] }) {
  if (results.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No spots match. Try widening your search.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(r) => r.google_place_id}
      renderItem={({ item }) => <Card item={item} />}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
    />
  );
}

function Card({ item }: { item: RestaurantResult }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <View style={styles.metaRow}>
        {item.rating != null && <Text style={styles.meta}>{item.rating.toFixed(1)}★</Text>}
        {item.price_tier != null && (
          <Text style={styles.meta}>{'$'.repeat(item.price_tier)}</Text>
        )}
        {item.cuisine && <Text style={styles.meta}>{item.cuisine}</Text>}
      </View>
      {item.address && <Text style={styles.address}>{item.address}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
    marginTop: space.md,
  },
  card: {
    padding: space.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  name: {
    ...type.title,
    color: colors.textOnDark,
  },
  metaRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 4,
  },
  meta: {
    ...type.label,
    color: colors.textOnDarkMuted,
  },
  address: {
    ...type.label,
    color: colors.textOnDarkFaint,
    marginTop: 4,
  },
  emptyWrap: {
    marginTop: space.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...type.label,
    color: colors.textOnDarkMuted,
  },
});
```

- [ ] **Step 2: Typecheck**

```bash
cd mobile && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ResultsList.tsx
git commit -m "Phase 2: add ResultsList component with empty-state copy"
```

---

## Task 16: Wire the search screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

Replace the existing file. The Search CTA in `HeroScreen` accepts `onPress` (verify by reading `mobile/components/HeroScreen.tsx`). If the CTA prop is named differently, use the actual prop. The keyboard-return path uses `onSubmitEditing` on the existing `TextInput`.

- [ ] **Step 1: Inspect HeroScreen API**

```bash
cd mobile && cat components/HeroScreen.tsx | head -50
```
Confirm the CTA item type and which prop fires on press (likely `onPress`).

- [ ] **Step 2: Rewrite `mobile/app/(tabs)/index.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HealthCheck } from '@/components/HealthCheck';
import { HeroScreen } from '@/components/HeroScreen';
import { FilterChips } from '@/components/FilterChips';
import { ResultsList } from '@/components/ResultsList';
import { colors, heroImages, space, type } from '@/lib/theme';
import { getDeviceLocation, type Coords } from '@/lib/location';
import { search, type SearchResponse } from '@/lib/search';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);

  useEffect(() => {
    (async () => {
      const r = await getDeviceLocation();
      if (r.kind === 'ok') setCoords(r.coords);
      else if (r.kind === 'denied') setLocDenied(true);
      else setError(r.message);
    })();
  }, []);

  const onSearch = async () => {
    if (!coords) return;
    if (query.trim().length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const r = await search(query.trim(), coords);
      setResponse(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <HeroScreen
        imageUri={heroImages.search}
        title="Find your next favorite"
        subtitle="Personalized for your taste, mood, and history."
        ctas={[
          { label: loading ? 'Searching…' : 'Search', variant: 'primary', onPress: onSearch },
          { label: 'Learn more', variant: 'secondary' },
        ]}
        topRight={<HealthCheck />}
      >
        <View style={styles.inputWrap}>
          <Text style={styles.label}>What are you craving?</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            placeholder="cozy ramen spot near me"
            placeholderTextColor={colors.textOnDarkFaint}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            editable={coords !== null}
          />
          {locDenied && (
            <Text style={styles.warning}>Enable location to search nearby.</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        {response && (
          <>
            <FilterChips filters={response.parsed_filters} />
            <ResultsList results={response.results} />
          </>
        )}
      </HeroScreen>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    gap: space.xs,
    marginTop: space.sm,
  },
  label: {
    ...type.label,
    color: colors.textOnDarkMuted,
  },
  input: {
    color: colors.textOnDark,
    fontSize: 17,
    fontWeight: '300',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  warning: {
    ...type.label,
    color: colors.textOnDarkFaint,
  },
  error: {
    ...type.label,
    color: '#ff6b6b',
  },
});
```

> **Note:** If `HeroScreen` does not accept `onPress` on CTA items (per Step 1's inspection), adapt the prop name accordingly; or move the search button out of `HeroScreen` into the children. The keyboard-return path via `onSubmitEditing` is the primary trigger and works regardless.

- [ ] **Step 3: Typecheck**

```bash
cd mobile && npm run typecheck
```
Expected: no errors. If errors point at `ctas[].onPress`, see the note above and adjust.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx
git commit -m "Phase 2: wire search screen to POST /search with location + chips + results"
```

---

## Task 17: Manual end-to-end smoke

**Files:** none — verification only.

Before running, ensure your `.env` files have keys:
- `backend/.env`: `ANTHROPIC_API_KEY=sk-ant-...` and `GOOGLE_PLACES_API_KEY=AIza...`
- `mobile/.env`: `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000`

- [ ] **Step 1: Backend up**

```bash
make up && cd backend && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Expected: server bound to `0.0.0.0:8000`, `/health` returns 200.

- [ ] **Step 2: Backend tests green**

In a second terminal:
```bash
cd backend && pytest -v
```
Expected: all PASS.

- [ ] **Step 3: Mobile typecheck + boot**

```bash
cd mobile && npm run typecheck && npm start
```
Expected: Expo dev server prints QR code. Open in Expo Go on iPhone.

- [ ] **Step 4: Grant location permission in Expo Go**

Expected: search input becomes editable; `HealthCheck` pill is green.

- [ ] **Step 5: Search "cozy ramen spot"**

Expected:
- `FilterChips` shows at least `ramen` (and any other parsed fields).
- `ResultsList` shows 5–20 ramen places.
- Watching the backend log, one Anthropic call and one Google Places call.

- [ ] **Step 6: Repeat the same query**

Expected:
- Response is noticeably faster.
- Backend log shows `cache HIT key=search:...` and no Anthropic/Places calls.

- [ ] **Step 7: Search "nothing-cuisine xyz123abcdef"**

Expected: empty-state copy renders below the (possibly empty) chips.

- [ ] **Step 8: Stop the backend (Ctrl-C in Step 1 terminal)**

Re-tap Search in the app. Expected: error text appears below the input ("Search failed (…)") and the `HealthCheck` pill goes red.

- [ ] **Step 9: Verify Postgres rows**

After restarting the backend and running one successful search:
```bash
docker exec rr-postgres psql -U postgres -d restaurant_recommender -c "SELECT count(*) FROM restaurants;"
```
Expected: count > 0.

- [ ] **Step 10: Commit nothing (smoke is verification only)**

If you discover bugs, open them as new tasks/issues; don't expand this plan.

---

## Task 18: Open Phase 2 PR

**Files:** none.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin phase-2-core-search
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "Phase 2: core search (POST /search + Claude parse + Google Places)" --body "$(cat <<'EOF'
## Summary
- Adds POST /search wiring Claude Haiku parse + Google Places v1 + Postgres upsert + Redis two-layer cache.
- Adds mobile location + search client + FilterChips + ResultsList; wires the existing search screen end-to-end.
- Backend test suite expanded to cover cache key helpers, filters, parse, places, restaurants upsert, and the router.

Spec: `docs/superpowers/specs/2026-05-17-phase-2-core-search-design.md`
Plan: `docs/superpowers/plans/2026-05-17-phase-2-core-search.md`

## Test plan
- [ ] `cd backend && pytest -v` — all green
- [ ] `cd mobile && npm run typecheck` — clean
- [ ] Manual smoke per Task 17 of the plan: search returns results, repeat query is cached, empty cuisine renders empty-state, backend down shows error + red HealthCheck pill, `restaurants` table populated after one search.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify PR URL is returned**

Expected: `gh` prints the new PR URL. Share with the user.

---

## What's intentionally NOT in this plan

- Rate-limiting per user (Phase 5).
- Daily budget caps in code (handled in Google Cloud Console).
- Retry-with-backoff on Anthropic/Places (one attempt; user retries).
- Pagination of search results.
- Photo fetching from Google Places (`photo_url` is set to `None` for now).
- Distance computation (`distance_m` left null — Phase 3 can add it; backend has lat/lng to do it cheaply).
- Mobile component tests (RN Testing Library setup cost > benefit at this stage).
- Background ingestion / queue (Phase 4).

---

## Self-review

**Spec coverage:**
- POST /search w/ {results, parsed_filters} → Tasks 3, 10 ✓
- Claude Haiku parse with soft-fail fallbacks → Task 7 ✓
- Google Places v1 searchText + 7-day candidate cache → Task 8 ✓
- Hard filters (rating, price; dietary deferred per task 6 note) → Task 6 ✓
- Postgres upsert keyed by google_place_id → Task 9 ✓
- Redis two-layer cache (10min response + 7d candidates) → Tasks 4, 8, 10 ✓
- Device GPS via expo-location → Tasks 11, 12 ✓
- Mobile FilterChips + ResultsList + screen wiring → Tasks 14, 15, 16 ✓
- Error handling matrix from spec → Tasks 7 (parse fallbacks), 8 (places 5xx), 10 (router 502 + swallow upsert) ✓
- Test fixtures (places_indian_sf.json, claude_parse_indian.json) → Tasks 7, 8 ✓
- Manual smoke checklist → Task 17 ✓
- New deps (anthropic, redis, httpx runtime, fakeredis, respx) → Task 1 ✓
- New config knobs → Task 2 ✓

**Note on `redis_url` already in config:** confirmed — present in `app/config.py:18`. No change needed.

**Note on `httpx` already in dev deps:** promoting it to runtime in Task 1 (it was dev-only because conftest used it as a test client; now `places.py` uses it at runtime).
