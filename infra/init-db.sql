-- Runs once on first Postgres init (via docker-entrypoint-initdb.d).
-- Alembic migrations also CREATE EXTENSION; keeping these here ensures
-- a fresh connection sees the extensions ready. Idempotent.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
