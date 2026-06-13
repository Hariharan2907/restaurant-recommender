# Phase 2 — Core Search: Design

**Date:** 2026-05-17
**Status:** Approved (brainstorming complete)
**Phase:** 2 of 5 (per `PLAN.md`)
**Prior phase:** Phase 1 scaffolding shipped in PR #1 (commit `cb23ea5`)

## Goal

Ship a working end-to-end natural-language restaurant search:

- User types a natural-language query in the mobile app.
- Backend parses it with Claude Haiku into structured filters.
- Backend queries Google Places (live), applies hard filters, upserts results into Postgres, caches via Redis, returns results plus the parsed filters.
- Mobile renders the echoed filter chips and a results list under the existing dark-hero search screen.

This is the first phase that exercises real third-party APIs end-to-end. It does **not** include personalization (Phase 3), reviews/dishes (Phase 4), or production polish (Phase 5).

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Data source | Live Google Places + Anthropic from day one (not mock-first) |
| Location | Device GPS via `expo-location` |
| Endpoint shape | Single `POST /search` returning `{results, parsed_filters}` |
| Persistence | Upsert into Postgres `restaurants` **and** Redis cache the response |
| Architecture | Linear pipeline in one router with service helpers (Approach A) — not background-job split or two-router split |

## Architecture

### File layout — additions only

**Backend** (`backend/app/`):

```
app/
  routers/
    search.py            # POST /search — Phase 2 endpoint
  services/              # NEW package — plain async functions, no FastAPI imports
    __init__.py
    parse.py             # Claude Haiku: natural-language → ParsedFilters
    places.py            # Google Places v1 client + Redis caching
    filters.py           # apply hard filters to Places candidates (pure)
    restaurants.py       # upsert into Postgres restaurants table
  schemas/
    search.py            # SearchRequest, SearchResponse, ParsedFilters
  cache.py               # NEW — Redis client singleton + key helpers
  llm.py                 # NEW — Anthropic client singleton
```

**Mobile** (`mobile/`):

```
app/(tabs)/
  index.tsx              # wire onSubmitEditing → call backend, render results
components/
  ResultsList.tsx        # NEW — FlatList of restaurant cards, dark theme
  FilterChips.tsx        # NEW — displays echoed parsed_filters
lib/
  location.ts            # NEW — expo-location wrapper
  search.ts              # NEW — typed client for POST /search
```

`expo-location` is added via `npx expo install expo-location` so it pulls the SDK-54-compatible version.

### Principles

- `services/` modules contain plain async functions with typed inputs/outputs. No `Request` / `Response` dependencies. Phase 3's `/recommendations` endpoint will reuse the same helpers and insert a ranking step.
- One Redis client and one Anthropic client, initialized at startup and injected as FastAPI dependencies.
- One Postgres session per request via the existing dependency in `app/db.py`.

## Components & contracts

### Pydantic schemas (`schemas/search.py`)

```python
class SearchRequest(BaseModel):
    query: str                  # raw natural language, max ~200 chars
    lat: float
    lng: float
    radius_m: int = 3000        # default 3km, capped at 20km

class ParsedFilters(BaseModel):
    cuisine: str | None         # e.g. "indian"
    min_rating: float | None    # 0.0-5.0
    vibe_tags: list[str] = []   # e.g. ["cozy", "date-night"]
    dietary: list[str] = []     # ["vegetarian", "vegan", "gluten_free"]
    price_max: int | None       # 1-4 (Google price levels)
    intent: str | None          # "eat-now" | "explore" | "plan-later"

class RestaurantResult(BaseModel):
    google_place_id: str
    name: str
    cuisine: str | None
    rating: float | None
    price_tier: int | None
    lat: float
    lng: float
    address: str | None
    photo_url: str | None       # one photo, optional
    distance_m: int | None      # computed from request location

class SearchResponse(BaseModel):
    parsed_filters: ParsedFilters
    results: list[RestaurantResult]   # up to 20, after filtering
    cached: bool                       # whether Redis hit
```

### Service contracts

| Module | Function | Signature & behavior |
|---|---|---|
| `parse.py` | `parse_query` | `(query: str) -> ParsedFilters`. Calls Claude Haiku with the parse prompt; returns an empty `ParsedFilters` on invalid JSON, timeout, or missing API key (logs a warning, never raises). |
| `places.py` | `find_places` | `(text_query: str, lat: float, lng: float, radius_m: int) -> list[PlaceRaw]`. Calls Google Places v1 `searchText` with `text_query`, location-biased. Caches by `(text_query, lat_q, lng_q, radius_m)` for 7 days. The router computes `text_query = filters.cuisine or original_query` so the cache key reflects what was actually sent to Google. |
| `filters.py` | `apply_filters` | `(places: list[PlaceRaw], filters: ParsedFilters) -> list[RestaurantResult]`. Pure function. Drops anything failing `min_rating`, `price_max`, or `dietary`. |
| `restaurants.py` | `upsert_many` | `(session: AsyncSession, results: list[RestaurantResult]) -> None`. `INSERT ... ON CONFLICT (google_place_id) DO UPDATE` for `name, cuisine, price_tier, lat, lng, rating`. Other columns left untouched. |

### Router (`routers/search.py`)

`POST /search` orchestrates: response-cache lookup → `parse_query` → `find_places` → `apply_filters` → `upsert_many` → write response-cache → return `SearchResponse`. ~50 lines total; logic lives in `services/`.

### Mobile client (`lib/search.ts`)

```ts
export type SearchResponse = {
  parsed_filters: ParsedFilters;
  results: RestaurantResult[];
  cached: boolean;
};

export async function search(
  query: string,
  loc: { lat: number; lng: number }
): Promise<SearchResponse>;
```

Built on the existing `apiFetch` helper in `mobile/lib/api.ts`.

## Data flow

### Request path

1. User types query, hits return on the existing `TextInput` in `mobile/app/(tabs)/index.tsx`.
2. Mobile reads cached GPS coords (permission granted on screen mount).
3. Mobile `POST /search` with `{query, lat, lng}`.
4. Backend computes the response-cache key (`search:<hash>`) and checks Redis.
   - **Hit** → return cached `SearchResponse` with `cached: true`.
   - **Miss** → continue.
5. `services.parse.parse_query` calls Anthropic Haiku → `ParsedFilters`.
6. `services.places.find_places`:
   - Computes places-cache key (`places:<filter-hash>`), checks Redis.
   - **Hit** → use cached candidates.
   - **Miss** → call Google Places v1 `searchText`, cache for 7 days.
7. `services.filters.apply_filters` drops candidates failing hard filters.
8. `services.restaurants.upsert_many` writes survivors to Postgres.
9. Write `SearchResponse` to Redis with 10-minute TTL.
10. Return `SearchResponse {cached: false}`.

Mobile renders `<FilterChips>` (from `parsed_filters`) and `<ResultsList>` below the hero.

### Cache keys

- **Search-response cache** (`search:`): SHA1 of `{query_normalized, lat_q, lng_q, radius_m}`. `query_normalized` is lowercased + trimmed; lat/lng quantized to 3 decimal places (~100m grid). TTL **10 minutes** per `PLAN.md`.
- **Places-candidates cache** (`places:`): SHA1 of `{text_query, lat_q, lng_q, radius_m}`, lat/lng quantized to 3 decimals. TTL **7 days** per `PLAN.md`. `text_query` is the parsed cuisine when present, otherwise the raw normalized user query — so different natural-language queries that parse to the same cuisine + location share the candidate cache.

The two-layer cache means repeating the same query is instant (Redis only), and different queries that parse to the same cuisine still skip Google Places.

### Postgres writes

One upsert per filtered result, keyed by `google_place_id`. Fields written: `name, cuisine, price_tier, lat, lng, rating`. Fields left null until later phases: `yelp_id, dietary_flags, vibe_tags, embedding`.

`cuisine` is populated from `ParsedFilters.cuisine` (Google's `types` field is too generic — `restaurant`, `meal_takeaway`). Phase 3 can refine.

### Mobile data flow

1. On mount of `app/(tabs)/index.tsx`, request foreground location permission.
2. If denied: show inline warning above the input, disable the search button (no hardcoded fallback in Phase 2).
3. Either `onSubmitEditing` on the `TextInput` (keyboard return) or tapping the existing "Search" CTA in the `HeroScreen` triggers `search(query, {lat, lng})` → render `<FilterChips>` + `<ResultsList>` below the hero. Hero stays mounted; results push the screen into a scrollable layout. The existing "Learn more" CTA is left as a no-op for Phase 2.
4. No pagination in Phase 2 — one batch of up to 20 results.

## Error handling

Principle: **fail soft on parse, fail loud on infrastructure.** A bad LLM response shouldn't break search; a dead Postgres should.

| Failure | Backend | Mobile sees | Why |
|---|---|---|---|
| Claude returns invalid/non-JSON | Log warning, return empty `ParsedFilters`. Search continues as plain-text Google query. | Empty `parsed_filters` chips, results still render | LLM unreliability is expected |
| Claude timeout (>3s) or 5xx | Same as above | Same | Same |
| Anthropic API key missing | Log warning at startup; runtime calls short-circuit to empty parse | Same | Lets local dev run without an Anthropic key |
| Google Places returns 0 places | Empty `results` | Empty-state UI | Normal outcome |
| Google Places 4xx/5xx/timeout | Log error, return HTTP 502 with `{detail: "places_error"}` | Toast: "Search unavailable — try again." | Caller can't recover |
| All places filtered out | Empty `results`, populated `parsed_filters` | Empty-state shows interpreted chips ("Indian · 4★ — no matches") | User can see *why* nothing matched |
| Postgres upsert fails | Log error, **swallow** — still return the response | Results render normally | Upsert is a side-effect for Phase 3; never block the user |
| Redis unavailable | Log warning, bypass cache | Slower response but works | Cache is a perf optimization |
| GPS permission denied | n/a | Inline warning, search disabled | Phase 2 requires a location |
| Backend unreachable | n/a | `HealthCheck` pill red + offline toast | Reuses existing observability |

### Timeouts

- Anthropic: 3s hard timeout.
- Google Places: 5s hard timeout.
- Whole `/search`: no explicit timeout (sum of the above + overhead).

### Logging

Per `PLAN.md` ("Log every Claude call with input/output/latency"): `parse_query` emits one structured stdout line per call — `query, parsed_filters, latency_ms, model`. Production wiring deferred.

### Explicitly out of scope for Phase 2

- Rate-limiting per user (Phase 5)
- Daily-budget caps in code (Google Cloud Console handles it)
- Retries with backoff (one attempt; user retries on failure)
- Extra schema validation on Claude JSON beyond Pydantic's parse

## Testing

Strategy: **unit-test the pure pieces, integration-test the wiring with mocks, smoke-test live end-to-end.**

### Backend tests

| Module | Test type | Coverage |
|---|---|---|
| `services/filters.py` | Unit, pure | Hard-filter survives/drops per rule. Edge cases: empty filters (pass-through), all-fail, dietary mismatch, rating boundary |
| `services/parse.py` | Unit with mocked Anthropic | (a) Happy path. (b) Invalid JSON → empty `ParsedFilters` + warning. (c) Timeout → empty |
| `services/places.py` | Unit with mocked httpx (`respx`) | (a) Cache hit → no HTTP call. (b) Cache miss → call + cache write. (c) 5xx → raises. (d) Quantization: lat 40.1234 and 40.1238 hit the same key |
| `services/restaurants.py` | Integration vs test Postgres | New insert; update-on-conflict for existing `google_place_id`. Transactional rollback per test |
| `routers/search.py` | Integration with externals mocked | One test per branch: cache hit, cache miss, Places error → 502 |

### Test infrastructure (new)

- `backend/tests/conftest.py` — fixtures: `async_client` (httpx `AsyncClient` against the app), `db_session` (transactional), `mock_redis` (fakeredis), `mock_anthropic`, `mock_httpx`.
- `backend/tests/fixtures/` — canned `places_indian_sf.json` and a canned Claude parse response.
- Dependencies: `pytest`, `pytest-asyncio`, `fakeredis`, `respx` added to backend requirements.

### Mobile tests

| File | Test type | Coverage |
|---|---|---|
| `lib/search.ts` | Unit with `fetch` stubbed | (a) Correct body. (b) Throws on non-2xx. (c) Returns typed response |
| `FilterChips.tsx`, `ResultsList.tsx` | Deferred | RN Testing Library setup not justified in Phase 2 |

No new mobile test infra (Jest, RN Testing Library) added in Phase 2. Manual smoke covers it.

### Manual smoke (Phase 2 "done" gate, for the PR checklist)

- [ ] `make up && cd backend && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --reload`
- [ ] `cd backend && pytest` — all green
- [ ] `cd mobile && npm run typecheck && npm start`
- [ ] Open in Expo Go, grant location permission
- [ ] Search "cozy ramen spot" → (a) `parsed_filters` chips render, (b) 5–20 ramen places shown, (c) repeating the same query is noticeably faster (Redis hit, `cached: true`)
- [ ] Search "nothing-cuisine xyz123" → empty-state with parsed-filter chips
- [ ] Stop the backend → search shows offline toast and `HealthCheck` pill goes red
- [ ] `docker exec rr-postgres psql -U postgres -d restaurant_recommender -c "SELECT count(*) FROM restaurants;"` → count > 0 after a successful search

### Explicitly out of scope for Phase 2 tests

- Load / latency testing
- Mocking the full Google Places v1 response surface (one happy-path fixture is enough)
- E2E tests with Detox / Maestro

## New configuration

Backend `.env` (developer-supplied, gitignored):

```
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_PLACES_API_KEY=AIza...
```

Both already exist as fields in `backend/app/config.py` with empty-string defaults; no code changes needed there.

## What ships at end of Phase 2

- `POST /search` live against real Google Places + Anthropic Haiku.
- Mobile search screen wired end-to-end with location, filter chips, and results list.
- Postgres `restaurants` table populated by every search.
- Redis caching at two layers (response 10min, candidates 7d).
- Backend test suite covering `services/` and the search router with mocked externals.
- Updated PR following the Phase-1 manual-smoke convention.

## What's next (Phase 3, for context only)

Personalization: visit logging UI, restaurant embeddings, user taste-profile vector, vector similarity search, Claude Sonnet rank endpoint using history. Per `PLAN.md`.
