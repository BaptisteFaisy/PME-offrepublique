# Convenience wrappers. The docker paths are the supported dev flow.
.PHONY: up down logs backend-test backend-lint migrate revision front-install front-dev front-build

up:            ## Start the full stack (db, redis, minio, backend, worker)
	docker compose up --build

down:          ## Stop and remove containers
	docker compose down

logs:          ## Tail backend + worker logs
	docker compose logs -f backend worker

migrate:       ## Apply DB migrations inside the backend container
	docker compose run --rm backend alembic upgrade head

revision:      ## Autogenerate a migration:  make revision m="add table x"
	docker compose run --rm backend alembic revision --autogenerate -m "$(m)"

backend-test:  ## Run backend tests in the container
	docker compose run --rm backend pytest

backend-lint:  ## Lint the backend
	docker compose run --rm backend ruff check app tests

front-install: ## Install web deps (site + internal /dce console)
	cd site-presentation && npm install

front-dev:     ## Run the Next.js dev server (marketing site + /dce console)
	cd site-presentation && npm run dev

front-build:   ## Production build of the web app
	cd site-presentation && npm run build
