# restaurant-recommender

A mobile-first app that gives personalized restaurant recommendations based on user history and natural-language queries. See [PLAN.md](./PLAN.md) for the full product spec.

## Status

Phase 1 — scaffolding the local dev stack (Postgres + Redis + FastAPI backend).

## Repo Layout

```
backend/            FastAPI (Python 3.11+) service
mobile/             React Native + Expo app
infra/              Infrastructure files (init scripts, etc.)
docker-compose.yml  Local dev stack: Postgres (pgvector), Redis, backend
Makefile            Convenience targets for common commands
```

## Local Dev Quickstart

Requires Docker Desktop (or compatible) with Compose v2.

### Data services only (recommended for backend dev)

Run Postgres + Redis in containers; run the FastAPI backend natively on the host with `uvicorn`. This is the typical workflow.

```bash
docker compose up -d postgres redis
# or
make up
```

Then start the backend natively per `backend/README.md`.

### Full stack (including backend in compose)

Brings up Postgres, Redis, and the backend service (hot reload via volume mount).

```bash
docker compose --profile full up -d
# or
make up-full
```

### Tearing down

```bash
docker compose down       # stop containers, keep volumes
docker compose down -v    # also wipe pgdata + redisdata volumes
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
| Backend  | 127.0.0.1:8000         | FastAPI (only when run via `--profile full`) |

Postgres ships with the `pgvector` and `pgcrypto` extensions pre-created (see `infra/init-db.sql`).

See [`.env.example`](./.env.example) for the documented dev defaults.

## Per-service docs

- Backend: [`backend/README.md`](./backend/README.md)
- Mobile: [`mobile/README.md`](./mobile/README.md)

## License

TBD
