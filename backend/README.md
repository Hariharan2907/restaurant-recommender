# Restaurant Recommender — Backend

FastAPI + Postgres (pgvector) + Alembic. Phase 1 scaffolding.

## Prerequisites

- Python 3.11+
- A running Postgres 16 with the `vector` and `pgcrypto` extensions available
  (the initial migration creates them). For local dev, use the project's
  docker-compose setup.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

## Migrations

```bash
alembic upgrade head
```

To roll back:

```bash
alembic downgrade base
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: <http://localhost:8000/health>

## Tests

Tests stub the database dependency, so no live Postgres is required.

```bash
pytest
```

## Layout

```
app/
  main.py        FastAPI app + CORS
  config.py      pydantic-settings
  db.py          async SQLAlchemy engine + session
  models/        ORM models (User, Restaurant, ReviewRaw, PopularDish, Visit)
  routers/       HTTP routers (health)
  schemas/       Pydantic response models (placeholder)
alembic/
  versions/      Migration revisions
tests/
```
