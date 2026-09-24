# ELN — Electronic Lab Notebook (Monorepo)

A production-grade Electronic Lab Notebook backend for battery-science
labs: NestJS + PostgreSQL (TypeORM), local JWT/bcrypt auth, in-process
Excel ETL for 7 battery-science data tables, RBAC, version-history
snapshots, and a stubbed AI gateway. See `BACKEND_SPEC.md` for the full
table/endpoint specification this implementation follows.

The frontend SPA is a **reserved placeholder** (`apps/frontend`) — scaffolded
but not implemented this round. See `apps/frontend/README.md`.

## Monorepo layout

```
eln/
├─ apps/
│  ├─ backend/      # NestJS API server (implemented)
│  └─ frontend/     # Reserved SPA slot (placeholder only)
├─ packages/
│  └─ shared/        # @eln/shared — enums, DTOs, API route constants
├─ requests.http      # Manual API client collection (REST Client / Bruno)
├─ BACKEND_SPEC.md    # Full table + endpoint specification
└─ pnpm-workspace.yaml / turbo.json / tsconfig.base.json
```

Tooling: **pnpm workspaces** (disk-efficient installs, strict hoisting) +
**Turborepo** (task orchestration for `build`/`dev`/`lint`/`test`/`test:e2e`
across packages).

## Prerequisites

- Node.js 20 LTS
- pnpm 9 (`npm install -g pnpm`)
- PostgreSQL 14+ running locally (or reachable via `DATABASE_URL`)

## Setup

```bash
pnpm install
pnpm run build
pnpm --filter @eln/backend run typeorm:run:prod
pnpm --filter @eln/backend run seed
```

Create an empty database first. Supply `NODE_ENV=production`, `DATABASE_URL`,
and `JWT_SECRET` through the process environment or secret manager before
running these commands. `seed` is the production-safe first-run initializer.
It also requires `ELN_BOOTSTRAP_USERNAME` and `ELN_BOOTSTRAP_PASSWORD`;
`ELN_BOOTSTRAP_FULL_NAME` is optional.
Supply a unique password of at least 12 characters and at most 72 UTF-8 bytes
from a secret manager. On a migrated database with no users, the command
creates one Admin role, one administrator account and the default workflow.
Re-running it preserves the existing password and workflow. An untouched
four-role bootstrap from the previous release is converted to the single Admin
role; populated or customized installations are left alone. If the database
already has another user, initialization refuses to create an administrator.
No fixed login or demo projects are installed. Run the
production migration command `typeorm:run:prod` before `seed`.

For disposable test databases only, `seed:test` installs the historical test
fixtures, including fixed test accounts. It refuses to run with
`NODE_ENV=production`.

## Running

```bash
# Start the backend in watch mode
pnpm --filter @eln/backend run dev
# -> http://localhost:3000/api/v1
# -> Swagger UI: http://localhost:3000/api/docs

# Or run everything turbo knows about (currently just backend + shared build)
pnpm run dev
```

## Building

```bash
pnpm run build   # turbo: builds packages/shared, then apps/backend
pnpm run lint
```

## Testing

```bash
pnpm run test       # unit tests: parsers, auth service, optimistic-lock logic
pnpm run test:e2e   # full e2e flow — REQUIRES a running Postgres + seed data
```

Unit tests cover:
- All 7 Excel parsers (`apps/backend/src/data/parsers/__tests__/`), including
  the 4 CalendarLife post-processing fallback rules.
- `AuthService.validateUser` / `login` (bcrypt compare, JWT signing).
- `ExperimentsService` optimistic-lock (`409` on stale `versionNo`) and
  versionHistory snapshot writing.

e2e tests (`apps/backend/test/*.e2e-spec.ts`) cover the full flow: login →
list/create projects → experiment detail → Excel upload → query parsed
data → submit for review, plus a focused optimistic-lock 409 check.

## Manual API testing

Open `requests.http` at the repo root with the VS Code "REST Client"
extension (or import into Bruno). It covers every endpoint in
`BACKEND_SPEC.md` §三, using a `{{token}}` variable populated from the
login response.

## Environment variables

See `.env.example` for the full list. Key ones:

| Variable         | Purpose                                      |
| ---------------- | --------------------------------------------- |
| `DATABASE_URL`    | Postgres connection string (or use `DB_*`)    |
| `JWT_SECRET`      | HMAC secret for signing access tokens         |
| `JWT_EXPIRES_IN`  | Token lifetime (e.g. `8h`)                    |
| `PORT`            | HTTP port (default `3000`)                    |
| `UPLOAD_DIR`      | Local disk path for attachment file storage   |

## Architecture notes

- **No physical foreign keys.** All relations (`experimentId`, `userId`,
  `projectId`, etc.) are logical-only, indexed but not constrained, to
  support future horizontal scaling / sharding without migration pain.
- **`synchronize: false` always.** Migrations in
  `apps/backend/src/migrations/` are the source of truth. A
  `typeorm:sync` script exists for rapid local prototyping only — never
  run it against a real database.
- **Optimistic locking** on `experiments.versionNo`: every `PUT
  /experiments/:id` must supply the `versionNo` it last read; a mismatch
  returns `409 Conflict`. Every successful update or submit writes a full
  JSON snapshot to `versionHistory`.
- **Excel ETL** runs in-process (ExcelJS) inside the NestJS app — no
  separate Python service. `ParserRegistry` dispatches each worksheet to
  one of 7 parsers via a `detect()` check, and all parsed rows across all
  sheets are inserted in a single `queryRunner` transaction.
- **AI endpoints are stubbed** (`501 Not Implemented`) — see
  `apps/backend/src/ai/`. Real implementation (Python data service +
  LLM-backed insight generation over SSE) is deferred.
- **`packages/shared`** is framework-agnostic (no TypeORM/NestJS
  dependencies), so whatever frontend framework is eventually chosen for
  `apps/frontend` can consume the same enums/DTOs/route constants without
  rework.

## Scope boundaries (this round)

**Included:** monorepo tooling, `packages/shared`, full backend (15
tables, all endpoints in §3.1–3.4, Excel ETL with fallback rules, RBAC,
version history, JWT auth, seed script, unit + e2e tests, Swagger),
`apps/frontend` reserved placeholder, `requests.http` API client.

**Deferred:** frontend SPA implementation, real AI gateway, OAuth/SSO,
S3/OSS file storage (local disk for now), email notifications, audit
logging beyond `versionHistory`.
