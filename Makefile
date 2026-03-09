.PHONY: install dev dev-all build start clean \
        docker-setup docker-build docker-up docker-down \
        docker-logs docker-restart docker-shell docker-clean

# Development
install:
	npm install
	cd dashboard && npm install

dev:
	npm run dev

dev-all:
	npm run dev:all

build:
	npm run dashboard:build
	npm run build

start:
	node dist/index.js

clean:
	rm -rf dist dashboard/dist node_modules dashboard/node_modules

# Docker
docker-setup:
	mkdir -p data/wa_credentials
	touch data/baileys_store.db

docker-build:
	docker compose build

docker-up: docker-setup
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-restart:
	docker compose restart

docker-shell:
	docker compose exec app sh

docker-clean:
	docker compose down -v --rmi local
