IMAGE ?= task-api:local

.PHONY: install test run docker-build docker-run up down lint

install:
	cd app && npm install

test:
	cd app && npm test

run:
	cd app && npm run dev

docker-build:
	docker build -t $(IMAGE) app

docker-run: docker-build
	docker run --rm -p 3000:3000 $(IMAGE)

lint:
	helm lint helm/task-api

up:
	./scripts/kind-up.sh

down:
	./scripts/kind-down.sh
