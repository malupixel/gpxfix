.PHONY: up down build logs api-logs web-logs db test

up:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

api-logs:
	docker compose logs -f api

web-logs:
	docker compose logs -f web

db:
	docker compose exec db psql -U $${POSTGRES_USER:-routecommunity} -d $${POSTGRES_DB:-routecommunity}

test:
	cd api && mvn test
	cd web && npm run lint && npm run typecheck
