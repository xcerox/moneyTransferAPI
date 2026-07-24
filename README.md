# Money Transfer API

A small REST API for moving money between accounts. It runs locally as a plain Node process
and deploys as-is to AWS Lambda + API Gateway + DynamoDB.

Built with NestJS and strict TypeScript. Amounts are integer minor units (cents, never
floats), transfers are atomic, `POST /transfers` is idempotent, and errors map to sensible
HTTP status codes. Storage sits behind a port, so you can run it fully in memory (the default,
and what the tests use) or against DynamoDB by flipping the `REPO_DRIVER` env var. The domain
code doesn't change either way.

## Getting started

```bash
make install
cp .env.example .env    # local config
make dev                # in-memory store, watch mode, http://localhost:3000
```

Swagger UI is at `/docs`.

Config lives in `.env` (loaded via `@nestjs/config`); [.env.example](.env.example) documents
every variable. The ones you'll touch most: `PORT`, `LOG_LEVEL` (`debug` is handy locally),
`NODE_ENV=local` for pretty logs instead of raw JSON, and `REPO_DRIVER` to pick the store.
On AWS these come from `serverless.yml`, not the file.

## Tests

```bash
make test           # unit
make test-e2e       # e2e (supertest against the Nest app)
```

To run a single test: `pnpm test -- -t "insufficient funds"`.

## Accounts

Three accounts are seeded at startup (there's no create-account endpoint), all in USD:

| Account | Balance (minor units) | USD |
|---|---|---|
| `acc_1` | 100_000 | 1,000.00 |
| `acc_2` | 50_000 | 500.00 |
| `acc_3` | 0 | 0.00 |

## Endpoints

| Method | Route | What it does |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/accounts` | List accounts |
| GET | `/accounts/:id` | One account and its balance |
| POST | `/transfers` | Move money. Needs an `Idempotency-Key` header |
| GET | `/transfers` | History across every account |
| POST | `/transfers/:id/refund` | Reverse a completed transfer |

### Making a transfer

```bash
curl -X POST http://localhost:3000/transfers \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 11111111-1111-1111-1111-111111111111' \
  -d '{ "fromAccountId": "acc_1", "toAccountId": "acc_2", "amount": 2500 }'
```

`amount` is in cents. The `Idempotency-Key` is required. Retrying with the same key and body
gives you back the original response without moving money twice, and reusing a key with a
different body is a `409`. This is really the whole point here. A dropped connection and a
retry shouldn't charge someone twice.

### History and refunds

`GET /transfers` returns everything, newest first, including `FAILED` attempts. A failed
transfer never moves money but is kept as a record with a `failureReason` (e.g.
`INSUFFICIENT_FUNDS`), which is useful as an audit trail.

`POST /transfers/:id/refund` reverses a completed transfer atomically and marks it `REFUNDED`.
You get a `404` for an unknown transfer, `409` if it was already refunded or isn't refundable,
and `409` (`INSUFFICIENT_FUNDS`) if the receiving account has already spent the money.

## Errors

Every error comes back in the same envelope, mapped centrally in `DomainExceptionFilter`:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "...", "traceId": "..." } }
```

| When | Code | HTTP |
|---|---|---|
| Bad body / wrong types / non-positive amount | `VALIDATION_ERROR` / `INVALID_AMOUNT` | 400 |
| `from == to` | `SAME_ACCOUNT` | 400 |
| Missing `Idempotency-Key` | `IDEMPOTENCY_KEY_REQUIRED` | 400 |
| Account not found on `GET /accounts/:id` | `ACCOUNT_NOT_FOUND` | 404 |
| Refund of an unknown transfer | `TRANSFER_NOT_FOUND` | 404 |
| Transfer points at a missing account | `ACCOUNT_NOT_FOUND` | 422 |
| Not enough funds | `INSUFFICIENT_FUNDS` | 409 |
| Idempotency key reused with a different body | `IDEMPOTENCY_KEY_CONFLICT` | 409 |
| Refunding something already refunded | `TRANSFER_ALREADY_REFUNDED` | 409 |
| Refunding something that isn't completed | `TRANSFER_NOT_REFUNDABLE` | 409 |

One deliberate choice worth calling out: `ACCOUNT_NOT_FOUND` is a `404` on a direct `GET` but a
`422` inside a transfer. The error describes the condition; the status describes the context.

## How it's put together

There's one `AppModule` with two entry points. `src/main.ts` calls `app.listen()` for local
runs; `src/lambda.ts` calls `app.init()` (never `listen()`), wraps the app with
serverless-express, and caches the instance so warm invocations skip the boot.

Services talk to two ports, `AccountRepository` and `IdempotencyStore`, through Nest's DI,
which is what makes the storage swap clean:

- In memory, a transfer is one synchronous critical section over a `Map`. There's no `await`
  between reading the balances and writing them, so two concurrent transfers can't interleave
  and overdraw an account.
- On DynamoDB (`src/persistence/dynamodb/`), the same operation is a single `TransactWriteItems`
  call with a `balance >= :amount` condition. Different mechanism, same guarantee. The database
  refuses to let a balance go negative.

Either way, a failed transfer is written back as a `FAILED` row.

## Running against DynamoDB

The app picks its store from `REPO_DRIVER` at startup: anything but `dynamodb` gives you the
in-memory repo (the default), `dynamodb` wires up the DynamoDB adapter. The switch is confined
to [PersistenceModule](src/persistence/persistence.module.ts). The table names come from `.env`
too (`ACCOUNTS_TABLE_NAME`, `TRANSFERS_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`).

To try the real Lambda + DynamoDB path locally you need Docker:

```bash
make dev-offline    # starts DynamoDB Local, creates + seeds the tables, runs serverless-offline
make ddb-down       # stop the container when you're done
```

`make dev-offline` flips `IS_OFFLINE` and `REPO_DRIVER=dynamodb` for the run (so you don't have
to edit `.env`) and points the client at `http://localhost:8000`; everything else, including
the table names, is read from `.env`. Since a local DynamoDB comes up empty,
[scripts/setup-local-dynamodb.ts](scripts/setup-local-dynamodb.ts) creates the tables and
inserts the seed accounts, the job CloudFormation and the in-memory seed do on their own
elsewhere. It's safe to re-run to reset balances.

## Deploying

```bash
make deploy         # stage 'dev'
make prod           # stage 'prod'
make remove         # tear it all down
```

You'll need AWS credentials (`AWS_PROFILE` or `aws configure`). The infra is plain Serverless
Framework:

- [serverless.yml](serverless.yml) is one Lambda behind an `ANY /{proxy+}` HTTP API, so API
  Gateway just proxies and Nest does the routing (a lambdalith).
- [resources/policies.yml](resources/policies.yml) is the IAM statement, including
  `dynamodb:TransactWriteItems`, which the atomic transfer depends on.
- [resources/tables.yml](resources/tables.yml) defines three on-demand tables: `accounts`,
  `transfers`, and `idempotency` (the last with a TTL on `expiresAt`).

Two things to know: `.npmrc` pins pnpm to a flat `node_modules` so Serverless can package it
(npm grumbles about an unknown `node-linker` config, which is harmless since pnpm reads it and
npm ignores it), and the deployed stack doesn't seed accounts, so you'd seed the table yourself
or add a `POST /accounts` endpoint. There's no auth here; in production that's an API Gateway
authorizer (JWT / Cognito).

It's deployed as a single Lambda (a lambdalith), which is the right call at this size. If you
ever need to split it into per-endpoint functions, the trade-offs and a migration plan are
written up in [next-steps/fan-out.md](next-steps/fan-out.md).

## License

MIT. See [LICENSE](LICENSE).
