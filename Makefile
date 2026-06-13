.PHONY: dev up up-full down logs psql redis-cli reset-db

# One command for local development:
# Postgres + Redis -> migrations -> backend API -> Expo on the iOS simulator.
# Ctrl-C stops the API it started; data services stay up (use `make down` to stop them).
dev:
	@bash scripts/dev.sh

# Bring up data services only (Postgres + Redis). Backend runs natively on host.
up:
	docker compose up -d postgres redis

# Bring up the full stack including the backend service.
up-full:
	docker compose --profile full up -d --build

# Stop and remove containers (volumes preserved).
down:
	docker compose down

# Tail logs from all running services.
logs:
	docker compose logs -f

# Open a psql shell against the dev database.
psql:
	docker compose exec postgres psql -U postgres -d restaurant_recommender

# Open a redis-cli shell.
redis-cli:
	docker compose exec redis redis-cli

# Nuke the database volume and bring data services back up fresh.
reset-db:
	docker compose down -v
	docker compose up -d postgres redis
