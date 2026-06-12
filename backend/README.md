# Fork — Backend

FastAPI + Postgres (pgvector) + Redis + Alembic, with a background job worker.

## Prerequisites

- Python 3.11+
- Postgres 16 with `vector` and `pgcrypto` extensions (the local
  docker-compose provides this) and Redis.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # every variable is documented inline
```

## Migrations

```bash
alembic upgrade head
```

Revisions: `0001` initial schema · `0002` Supabase auth mapping
(`users.supabase_sub`) · `0003` profile preference columns + HNSW index on
`restaurants.embedding`.

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # API
python -m app.worker                                        # job worker
python -m app.worker backfill                               # one-shot catch-up
```

Interactive API docs: <http://localhost:8000/docs>

## Endpoints

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /health` | — | checks DB + Redis; 503 with sanitized detail when degraded |
| `POST /search` | optional | Haiku parse → Places → filters → explanations; taste-reordered for signed-in users with a trained profile |
| `GET /photo` | — | Google Places photo proxy (redirect, cached) |
| `POST /recommendations` | optional | PLAN.md flow: cache → parse → filters → pgvector taste ranking → Sonnet re-rank with last 20 visits + popular dishes + mood; cold-starts fall back to the /search ranking |
| `GET /discover` | required | nearby restaurants ranked by taste-profile similarity (pgvector HNSW) |
| `GET /me`, `PATCH /me`, `DELETE /me` | required | profile + preferences (dietary, radius, cuisine likes/dislikes) |
| `POST /visits`, `GET /visits`, `DELETE /visits/{id}` | required | visit logging; refreshes the taste vector and invalidates per-user caches |
| `GET /restaurants/{place_id}/dishes` | — | popular dishes extracted from reviews (carry Yelp/Google attribution when displaying) |

All `/search`-class and LLM-backed endpoints are rate-limited per user **and**
per IP (Redis fixed windows; see `RATE_LIMIT_*` env vars).

## Architecture notes

- **Auth**: Supabase JWTs verified against the project JWKS (ES256/RS256) or
  the legacy HS256 secret (`SUPABASE_JWT_SECRET`). `app/auth.py` resolves or
  creates the local `users` row by Supabase `sub`/email.
- **Embeddings**: Anthropic has no first-party embeddings API and recommends
  Voyage AI. We embed `name | cuisine | price | rating | vibe | dietary |
  popular dishes` with `voyage-3.5` (1024 dims) zero-padded to the schema's
  `vector(1536)` — cosine similarity is unaffected by zero padding.
- **Taste profile**: `users.taste_profile_vector` = normalized,
  `my_rating`-weighted mean of the last 50 visited restaurants' embeddings;
  refreshed on every visit create/delete. Per-user response caches are
  invalidated via a Redis version counter.
- **Background jobs** (`app/jobs.py`, `python -m app.worker`): Redis-list
  queue. `fetch_reviews` (Google Place Details + Yelp Fusion, 30-day gate) →
  `extract_dishes` (Haiku batch) → embedding refresh. Enqueued on visit
  logging; `backfill` sweeps stragglers (suitable as a nightly cron).
- **Soft-fail policy**: LLM/embedding/DB side-effects never break a request
  that can still return useful data.
- **Observability**: every Anthropic call logs purpose/model/latency/tokens
  (`app/llm.py`); JSON logs in production; Sentry enabled when `SENTRY_DSN`
  is set.

## Tests

```bash
pytest
```

Router/service tests are hermetic (fakeredis, respx, mocked Anthropic).
DB-backed tests (`test_taste`, `test_personalize`, visits/profile routers…)
need the local stack: `make up && alembic upgrade head`.

## Layout

```
app/
  main.py            app wiring: logging, CORS, security middleware, routers
  config.py          pydantic-settings (see .env.example)
  auth.py            Supabase JWT verification + user resolution
  ratelimit.py       Redis per-user/per-IP fixed-window limiter
  middleware.py      security headers + request-size limit
  logging_config.py  JSON logs in production
  llm.py             Anthropic client + per-call logging wrapper
  jobs.py worker.py  background queue + worker entrypoint
  models/ routers/ schemas/ services/
alembic/versions/    migration revisions
tests/
```
