.PHONY: install build lint test test-e2e \
        dev dev-memory dev-offline offline \
        ddb-up ddb-wait ddb-setup ddb-down \
        deploy prod remove

dev: dev-memory

dev-memory:
	pnpm start:dev

dev-offline: ddb-up ddb-wait ddb-setup offline

offline:
	pnpm sls:offline

ddb-up:
	pnpm ddb:start

ddb-wait:
	@until curl -s -o /dev/null http://localhost:8000; do sleep 1; done

ddb-setup:
	pnpm ddb:setup

ddb-down:
	pnpm ddb:stop

install:
	pnpm install

build:
	pnpm build

lint:
	pnpm lint

test:
	pnpm test

test-e2e:
	pnpm test:e2e

deploy:
	pnpm deploy

prod:
	pnpm deploy:prod

remove:
	pnpm remove
