# Fork — Deployment Guide

> Status: pre-launch. This documents target infrastructure and required
> configuration; nothing here runs automatically and no secrets live in the
> repo.

## Topology

| Component | Provider | Notes |
|-----------|----------|-------|
| Backend API (FastAPI) | Railway | Docker deploy from `backend/Dockerfile` |
| Background worker | Railway (2nd service) | same image, command `python -m app.worker` |
| Postgres + pgvector | Supabase | also provides Auth |
| Redis | Upstash | cache + rate limiting + job queue |
| Mobile | Expo EAS | iOS + Android builds |
| Errors | Sentry | backend enabled via `SENTRY_DSN` |
| Analytics | PostHog | mobile events via `EXPO_PUBLIC_POSTHOG_KEY` |

Environment variables are documented exhaustively in
[`backend/.env.example`](../backend/.env.example) and
[`mobile/.env.example`](../mobile/.env.example).

## 1. Supabase (DB + Auth)

1. Create a project; note the project URL and anon key.
2. Enable the `vector` extension (Dashboard → Database → Extensions).
   `pgcrypto` is enabled by default.
3. Run migrations against the Supabase Postgres:
   ```bash
   cd backend
   DATABASE_URL=postgresql+psycopg://postgres:<pw>@db.<ref>.supabase.co:5432/postgres \
     .venv/bin/alembic upgrade head
   ```
4. Auth → Providers: enable Email. Configure the email confirmation template.
5. JWT verification: nothing to do for new projects — the backend reads the
   JWKS endpoint. For legacy projects, copy the JWT secret into
   `SUPABASE_JWT_SECRET`.
6. Use the **connection pooler** (PgBouncer, transaction mode) connection
   string for `DATABASE_URL` in production (PLAN.md "Connection pooling").

## 2. Upstash (Redis)

1. Create a Redis database (same region as Railway).
2. Set `REDIS_URL` to the TLS URL (`rediss://default:<pw>@<host>:<port>`).

## 3. Railway (API + worker)

1. New project → deploy from repo, root `backend/` (Dockerfile build).
2. Service 1 — API: default command (uvicorn). Health check path `/health`.
3. Service 2 — worker: same image, override command:
   `python -m app.worker`.
4. Optional cron: schedule `python -m app.worker backfill` nightly
   (PLAN.md "Nightly cron to refresh popular dishes").
5. Set env vars on both services (see `backend/.env.example`). Production
   essentials:
   - `ENVIRONMENT=production` (JSON logs, hides error internals)
   - `CORS_ORIGINS=["https://<your-web-origin>"]` — never `*`
   - `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`,
     `GOOGLE_PLACES_API_KEY`, `YELP_API_KEY`, `VOYAGE_API_KEY`,
     `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN`
   - keep the default `RATE_LIMIT_*` values unless traffic justifies more

## 4. Google Places: daily spend cap (REQUIRED before launch)

Google Places API has no automatic refund for runaway usage. Before pointing
production traffic at it:

1. Open **Google Cloud Console → APIs & Services → Places API (New) → Quotas**.
2. Set **Requests per day** to a hard cap (start: `5,000/day` ≈ $150/mo worst
   case at Text Search Pro pricing — tune to your traffic).
3. Set **Requests per minute** to `100` to blunt spikes.
4. In **Billing → Budgets & alerts**, create a budget with email alerts at
   50% / 90% / 100% of your monthly target (e.g. $200).
5. Keep the backend-side mitigations on (defaults already do this):
   - `PLACES_CACHE_TTL_S=604800` (7-day Places cache)
   - `RATE_LIMIT_SEARCH_*` / `RATE_LIMIT_RECS_*` per-user/per-IP limits
6. Restrict the API key: **API restrictions → Places API (New) only**, and
   leave it server-side only (it ships in backend env, never in the app).

Anthropic + Voyage spend is bounded by the same rate limits plus response
caching (`SEARCH_CACHE_TTL_S`, `RECS_CACHE_TTL_S`, 30-day review refetch gate).

## 5. Sentry + PostHog

- **Sentry (backend)**: create a Python/FastAPI project, set `SENTRY_DSN`.
  Initialization lives in `app/main.py` (0.1 traces sample rate, no PII).
- **PostHog (mobile)**: create a project, set `EXPO_PUBLIC_POSTHOG_KEY`
  (+ `EXPO_PUBLIC_POSTHOG_HOST` for EU). Events are sent via the HTTP capture
  API from `mobile/lib/analytics.ts` (`search_submitted`, `visit_logged`);
  add more `capture()` calls as needed.

## 6. Expo EAS (mobile)

1. `npm i -g eas-cli && eas login && eas init` inside `mobile/`.
2. Configure `eas.json` build profiles; set per-profile env:
   - `EXPO_PUBLIC_API_URL=https://<railway-api-domain>`
   - `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_POSTHOG_KEY`
3. `eas build --platform all`, then `eas submit`.
4. **Yelp attribution**: dish data is derived from Google and Yelp reviews;
   the detail screen shows an attribution line. Review Yelp's display
   requirements and App Store guidelines before submitting (PLAN.md).

## Launch checklist

- [ ] Supabase project + migrations applied (`alembic upgrade head`)
- [ ] Upstash Redis reachable from Railway (TLS URL)
- [ ] Railway API + worker services green; `/health` returns `ok`
- [ ] Google daily spend cap + budget alerts configured (section 4)
- [ ] Rate limits verified (429 with `Retry-After` past the limit)
- [ ] `ENVIRONMENT=production` (JSON logs, sanitized errors) and explicit CORS
- [ ] Sentry receiving a test error; PostHog receiving a test event
- [ ] EAS builds pass; physical-device smoke test against production API
- [ ] No secrets in the repo (`.env` files are gitignored)
