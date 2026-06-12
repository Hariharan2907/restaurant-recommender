# Fork — restaurant recommender

A mobile-first app that gives personalized restaurant recommendations based on
user history and natural-language queries. See [PLAN.md](./PLAN.md) for the
full product spec and [docs/deploy.md](./docs/deploy.md) for deployment.

## Status

Phases 1–5 implemented:

- **Search** — natural-language query → Claude Haiku parse → Google Places →
  hard filters → per-result explanations.
- **Auth** — Supabase email/password on mobile; JWT verification (JWKS or
  legacy secret) on the backend.
- **Personalization** — visit logging, Voyage AI restaurant embeddings,
  per-user taste profile vector, pgvector similarity search, Claude Sonnet
  re-rank (`POST /recommendations`), Discover mode.
- **Reviews + dishes** — background worker fetches Google/Yelp reviews and
  extracts popular dishes with Claude Haiku.
- **Hardening** — per-user/per-IP rate limits (Redis), security headers,
  request-size caps, structured logging, Sentry hook, prod-safe errors.

## Repo Layout

```
backend/            FastAPI (Python 3.11+) service + background worker
mobile/             React Native + Expo app ("Fork")
infra/              Infrastructure files (init scripts, etc.)
docs/               Deployment guide (Railway/Supabase/Upstash/EAS)
docker-compose.yml  Local dev stack: Postgres (pgvector), Redis, backend
Makefile            Convenience targets for common commands
```

## Local Dev Quickstart

Requires Docker Desktop (or compatible) with Compose v2.

```bash
make dev      # Postgres + Redis -> migrations -> API -> Expo (one command)
```

Or piecewise:

```bash
make up       # Postgres + Redis only; run backend natively (backend/README.md)
make worker   # background job worker (reviews -> dishes -> embeddings)
make backfill # enqueue catch-up jobs for restaurants missing embeddings/dishes
```

### Tearing down

```bash
docker compose down       # stop containers, keep volumes
make reset-db             # wipe volumes and bring data services back up
```

### Handy shortcuts

```bash
make psql        # psql shell into the dev database
make redis-cli   # redis-cli shell
make logs        # tail logs from all services
```

## Shared Contract

| Service  | Host:Port              | Credentials                                 |
|----------|------------------------|---------------------------------------------|
| Postgres | 127.0.0.1:5432         | user `postgres` / pw `postgres` / db `restaurant_recommender` |
| Redis    | 127.0.0.1:6379         | no auth (dev only)                          |
| Backend  | 127.0.0.1:8000         | FastAPI                                      |

Postgres ships with the `pgvector` and `pgcrypto` extensions pre-created
(see `infra/init-db.sql`).

## Per-service docs

- Backend: [`backend/README.md`](./backend/README.md)
- Mobile: [`mobile/README.md`](./mobile/README.md)
- Deploy: [`docs/deploy.md`](./docs/deploy.md)

## License

TBD
