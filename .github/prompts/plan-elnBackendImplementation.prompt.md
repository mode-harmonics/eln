# Plan: ELN Monorepo (NestJS Backend + Frontend Reserved + PostgreSQL + TypeORM)

**TL;DR** — Build a production-grade Electronic Lab Notebook as a **monorepo** per `BACKEND_SPEC.md`: **NestJS (TypeScript) + PostgreSQL (TypeORM)** backend in `apps/backend`, a **reserved frontend slot** in `apps/frontend` (scaffolded but not implemented this round), shared types/DTOs in `packages/shared`, local JWT/bcrypt auth, in-process Excel ETL (ExcelJS) for 7 battery-science tables, RBAC, version-history snapshots, and stubbed AI endpoints. Scope = backend + minimal API client (HTTP collection) + monorepo tooling. Frontend implementation deferred; AI implementation deferred.

## Decisions (from user)
- **Monorepo**: single repo with `apps/` (backend, frontend) + `packages/` (shared). Backend implemented now; frontend slot reserved (scaffolded placeholder) for future SPA.
- Backend: Node.js + NestJS (TypeScript)
- DB: PostgreSQL (native JSONB) via **TypeORM** ORM
- Scope: Backend + minimal API client (frontend reserved, not implemented)
- AI: Skip for now — stub `/ai/analyze-data` and `/ai/generate-insights` with 501/placeholder responses
- Excel ETL: In-process in the NestJS app (ExcelJS), not a separate Python service
- Auth: Local JWT + bcrypt (email/password), matches `users.passwordHash`

## Tech Choices
- **Monorepo tooling**: pnpm workspaces + Turborepo (task orchestration: `build`, `test`, `lint`, `dev` across packages). pnpm chosen for disk efficiency and strict hoisting.
- Runtime: Node 20 LTS, TypeScript 5.x (shared `tsconfig.base.json` at root, per-package extends)
- Framework: NestJS 10 (in `apps/backend`)
- ORM: **TypeORM 0.3.x** (`@nestjs/typeorm`) — entities in `apps/backend/src/entities/*.entity.ts`, camelCase column names via property naming (TypeORM uses property names as column names by default), JSONB via `@Column({ type: 'jsonb' })`, migrations in `apps/backend/src/migrations/`
- Auth: `@nestjs/jwt` + `@nestjs/passport` (passport-jwt), `bcrypt`
- Validation: `class-validator` + `class-transformer` (global ValidationPipe)
- Excel: `exceljs` for parsing multi-sheet workbooks with multi-level headers
- Config: `@nestjs/config` with `.env` (per-app: `apps/backend/.env`)
- UUIDs: `@PrimaryGeneratedColumn('uuid')` (PostgreSQL native uuid) OR `@PrimaryColumn({ type: 'uuid' })` + `uuid` v4 — spec says VARCHAR(36); use `@PrimaryColumn({ type: 'uuid' })` with app-generated `uuid()` to keep control
- Testing: Jest (NestJS default) + supertest for e2e
- API client: a `requests.http` / Bruno collection file at repo root for manual testing
- **Shared package** (`packages/shared`): TypeScript types, DTO interfaces, enums (ExperimentStatus, RoleName, DataType), and API contract types — consumed by both backend and future frontend to avoid drift.

## Architecture (Monorepo)
```
eln/                          # repo root
├─ pnpm-workspace.yaml        # packages: ["apps/*", "packages/*"]
├─ turbo.json                 # pipeline: build, dev, lint, test, test:e2e
├─ package.json               # root scripts (dev/build/test delegating to turbo), devDeps: turbo, typescript
├─ tsconfig.base.json         # shared TS compiler options (strict, paths)
├─ .gitignore
├─ .env.example               # root-level example (documents backend env)
├─ requests.http              # API client collection (root, references apps/backend port)
├─ README.md
├─ BACKEND_SPEC.md
├─ apps/
│  ├─ backend/                # NestJS API server (IMPLEMENTED this round)
│  │  ├─ package.json
│  │  ├─ tsconfig.json        # extends ../../tsconfig.base.json
│  │  ├─ nest-cli.json
│  │  ├─ .env                 # DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, UPLOAD_DIR
│  │  ├─ data-source.ts       # standalone DataSource for CLI (migrations, seed)
│  │  ├─ src/
│  │  │  ├─ main.ts           # bootstrap, global pipes, CORS, Swagger
│  │  │  ├─ app.module.ts     # TypeOrmModule.forRootAsync(config), imports all feature modules
│  │  │  ├─ config/
│  │  │  │  ├─ typeorm.config.ts   # TypeOrmModuleOptionsFactory (reads env, entities, migrations, synchronize=false)
│  │  │  │  └─ configuration.ts    # env schema validation
│  │  │  ├─ common/
│  │  │  │  ├─ decorators/current-user.decorator.ts
│  │  │  │  ├─ decorators/roles.decorator.ts
│  │  │  │  ├─ guards/jwt-auth.guard.ts
│  │  │  │  ├─ guards/roles.guard.ts
│  │  │  │  ├─ filters/all-exceptions.filter.ts
│  │  │  │  └─ interceptors/logging.interceptor.ts
│  │  │  ├─ entities/         # all 15 TypeORM entities (one file per table)
│  │  │  │  ├─ user.entity.ts
│  │  │  │  ├─ role.entity.ts
│  │  │  │  ├─ project.entity.ts
│  │  │  │  ├─ experiment-collaborator.entity.ts
│  │  │  │  ├─ experiment.entity.ts
│  │  │  │  ├─ inventory.entity.ts
│  │  │  │  ├─ attachment.entity.ts
│  │  │  │  ├─ version-history.entity.ts
│  │  │  │  ├─ process-data.entity.ts
│  │  │  │  ├─ calendar-life.entity.ts
│  │  │  │  ├─ storage-swelling.entity.ts
│  │  │  │  ├─ energy-efficiency.entity.ts
│  │  │  │  ├─ dcr-test.entity.ts
│  │  │  │  ├─ fast-charge.entity.ts
│  │  │  │  └─ ht-cycle.entity.ts
│  │  │  ├─ auth/
│  │  │  │  ├─ auth.module.ts
│  │  │  │  ├─ auth.controller.ts     # POST /auth/login
│  │  │  │  ├─ auth.service.ts        # validateUser, signJwt
│  │  │  │  ├─ strategies/jwt.strategy.ts
│  │  │  │  └─ dto/login.dto.ts
│  │  │  ├─ users/
│  │  │  │  ├─ users.controller.ts    # GET /users/me
│  │  │  │  └─ users.service.ts
│  │  │  ├─ roles/
│  │  │  │  ├─ roles.controller.ts    # GET /roles
│  │  │  │  └─ roles.service.ts
│  │  │  ├─ projects/
│  │  │  │  ├─ projects.controller.ts # GET/POST /projects, PUT /projects/:id/members
│  │  │  │  ├─ projects.service.ts
│  │  │  │  └─ dto/
│  │  │  ├─ experiments/
│  │  │  │  ├─ experiments.controller.ts # GET/PUT /experiments/:id, POST /:id/submit
│  │  │  │  ├─ experiments.service.ts    # optimistic locking via versionNo, versionHistory snapshot
│  │  │  │  └─ dto/
│  │  │  ├─ data/
│  │  │  │  ├─ data.controller.ts     # POST /data/upload, GET /data/:type/:expId
│  │  │  │  ├─ data.service.ts        # dispatch to parsers, bulk insert via repository.save() in transaction (queryRunner)
│  │  │  │  └─ parsers/
│  │  │  │     ├─ parser.interface.ts
│  │  │  │     ├─ process-data.parser.ts
│  │  │  │     ├─ calendar-life.parser.ts   # + post-processing fallback logic
│  │  │  │     ├─ storage-swelling.parser.ts
│  │  │  │     ├─ energy-efficiency.parser.ts
│  │  │  │     ├─ dcr-test.parser.ts
│  │  │  │     ├─ fast-charge.parser.ts
│  │  │  │     ├─ ht-cycle.parser.ts
│  │  │  │     └─ parser.registry.ts
│  │  │  ├─ ai/
│  │  │  │  ├─ ai.controller.ts       # POST /ai/analyze-data, /ai/generate-insights (STUBBED)
│  │  │  │  └─ ai.service.ts          # returns 501 Not Implemented / placeholder
│  │  │  ├─ migrations/               # TypeORM migrations (generated)
│  │  │  │  └─ 1700000000000-Init.ts
│  │  │  └─ seed.ts                   # seed roles, demo users, sample project (uses DataSource)
│  │  └─ test/
│  │     └─ *.e2e-spec.ts
│  └─ frontend/               # RESERVED slot for future SPA (scaffolded placeholder only)
│     ├─ package.json         # minimal, depends on @eln/shared
│     ├─ tsconfig.json        # extends ../../tsconfig.base.json
│     ├─ README.md            # "Frontend not yet implemented. See apps/backend."
│     └─ src/
│        └─ index.ts          # placeholder: `console.log('ELN frontend — TODO')`
└─ packages/
   └─ shared/                 # shared types/DTOs/enums (IMPLEMENTED, consumed by backend + future frontend)
      ├─ package.json         # name: "@eln/shared", main: dist/index.js
      ├─ tsconfig.json
      └─ src/
         ├─ index.ts
         ├─ enums.ts          # ExperimentStatus, RoleName, DataType, ProjectStatus, InventoryStatus
         ├─ dto/              # request/response DTO interfaces (LoginDto, UserDto, ProjectDto, ExperimentDto, ...)
         └─ api-contract.ts   # endpoint path constants + response envelopes
```

## Steps (grouped into phases)

### Phase 1 — Monorepo Scaffold & DB Schema (foundation, blocks all)
1. **Init monorepo**: create root `package.json` (private, no name collision), `pnpm-workspace.yaml` (`packages: ["apps/*", "packages/*"]`), `turbo.json` (pipeline for `build`/`dev`/`lint`/`test`/`test:e2e` with `dependsOn`/`outputs`), `tsconfig.base.json` (strict, `emitDecoratorMetadata`/`experimentalDecorators` on, `paths` for `@eln/shared`). Root devDeps: `turbo`, `typescript`.
2. **Scaffold `apps/backend`** (NestJS): `nest new` into `apps/backend`, install deps: `@nestjs/typeorm typeorm pg`, `@nestjs/jwt @nestjs/passport passport passport-jwt`, `bcrypt`, `class-validator class-transformer`, `exceljs`, `uuid`, `@nestjs/config`, `@nestjs/swagger`, `@nestjs/mapped-types`, `@eln/shared` (workspace dep). Dev deps: `@types/bcrypt @types/passport-jwt @types/multer`. Configure `apps/backend/tsconfig.json` (extends root base), `apps/backend/package.json` scripts (`typeorm:generate`, `typeorm:migrate`, `typeorm:run`, `seed`, `build`, `start`, `test`, `test:e2e`).
3. **Scaffold `packages/shared`**: `package.json` (`name: "@eln/shared"`), `tsconfig.json`, `src/index.ts`, `src/enums.ts` (ExperimentStatus, RoleName, DataType, ProjectStatus, InventoryStatus), `src/dto/` (request/response DTO interfaces), `src/api-contract.ts` (endpoint path constants + response envelopes). Backend imports enums/DTOs from `@eln/shared`.
4. **Reserve `apps/frontend`**: minimal `package.json` (depends on `@eln/shared`), `tsconfig.json`, `README.md` ("Frontend not yet implemented"), `src/index.ts` placeholder. Not built out this round.
5. Write all **15 TypeORM entities** in `apps/backend/src/entities/`:
   - `@PrimaryColumn({ type: 'uuid' })` + app-generated `uuid()` for all PKs (matches VARCHAR(36)).
   - camelCase column names (TypeORM uses property names by default → columns are camelCase, matching spec).
   - JSONB columns via `@Column({ type: 'jsonb', nullable: true })` for: `roles.permissionList`, `experiments.metadata`, `versionHistory.snapshot`, `fastCharge.steps`, `htCycle.caps`.
   - `@Index()` on logical FKs: `experimentId`, `projectId`, `userId`, `cellId`/`cellName`, `cycle`.
   - `@CreateDateColumn()` / `@UpdateDateColumn()` for timestamps where applicable.
6. Create `apps/backend/.env` + root `.env.example` (DATABASE_URL or DB_HOST/PORT/USER/PASSWORD/NAME, JWT_SECRET, JWT_EXPIRES_IN, PORT, UPLOAD_DIR).
7. `apps/backend/data-source.ts` standalone DataSource (for CLI migration/seed); `apps/backend/src/config/typeorm.config.ts` for app runtime (`synchronize: false`, `migrationsRun: false` in prod).
8. Generate initial migration: `pnpm --filter @eln/backend run typeorm:generate -- src/migrations/Init` then `typeorm:run`.
9. Write `apps/backend/src/seed.ts`: seed 4 roles (Owner/Admin/Editor/Viewer) with permissionList, 2 demo users (one PI, one editor), 1 project, 1 experiment. Run via `pnpm --filter @eln/backend run seed`.

### Phase 2 — Core Infrastructure (parallel with Phase 1 schema work after step 5)
10. `TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService })` in `AppModule` (apps/backend); `forFeature([...entities])` per feature module.
11. Global `ValidationPipe` (whitelist, transform, forbidNonWhitelisted), `AllExceptionsFilter`, CORS, Swagger setup in `apps/backend/src/main.ts`. API prefix `/api/v1`.
12. JWT auth guard, roles guard, `@CurrentUser()` decorator, `@Roles()` decorator.

### Phase 3 — Auth & IAM (depends on 1,2,9,12)
13. `AuthModule`: `POST /auth/login` → validate email/password (`bcrypt.compare`), return `{ accessToken, user: {id, email, fullName, role} }`.
14. `UsersModule`: `GET /users/me` → return current user + role + permissionList.
15. `RolesModule`: `GET /roles` → return role matrix.

### Phase 4 — Projects & Experiments (depends on Phase 3)
16. `ProjectsModule`: `GET /projects` (filter by user membership/ownership), `POST /projects`, `PUT /projects/:id/members` (upsert experimentCollaborators for all experiments in project).
17. `ExperimentsModule`: `GET /experiments/:id` (include attachments + collaborators), `PUT /experiments/:id` (auto-save with optimistic lock: check `versionNo`, increment, write `versionHistory` snapshot), `POST /experiments/:id/submit` (status Draft→In Review, lock).

### Phase 5 — Excel ETL Pipeline (depends on Phase 1 schema, parallel with Phase 4)
18. Define `DataParser` interface: `detect(sheet) => boolean`, `parse(sheet, experimentId) => rows[]`.
19. Implement 7 parsers, each handling multi-level header propagation:
    - `ProcessDataParser` (flat columns m0..gr1, picked)
    - `CalendarLifeParser` (horizontal→vertical flatten by dayCount; apply 4 post-processing fallback rules: q_0d backfill, ddcr/cdcr mutual copy, r_0d/u_0d backfill, dq auto-calc)
    - `StorageSwellingParser` (vertical by dayCount)
    - `EnergyEfficiencyParser` (de, ce, notes)
    - `DcrTestParser` (q0, du0/du1, di, cu0/cu1, ci)
    - `FastChargeParser` (c0, providedFastChargeTime, steps JSONB array)
    - `HtCycleParser` (cycle as row, caps JSONB dict with batteryId + batteryId_ret)
20. `ParserRegistry` maps sheet-name patterns → parser.
21. `DataModule`: `POST /data/upload` (multipart, experimentId) → load workbook with ExcelJS, iterate sheets, detect+parse, bulk insert per table in a `queryRunner` transaction (`repository.save(rows)`); `GET /data/:type/:expId` → return rows for type ∈ {process, calendar, swelling, efficiency, dcr, fastcharge, htcycle}.

### Phase 6 — AI Gateway Stub (parallel, independent)
22. `AiModule`: `POST /ai/analyze-data` and `POST /ai/generate-insights` return HTTP 501 with `{ message: "AI service not yet implemented", endpoint }`. Document as TODO for future Python service + LLM integration.

### Phase 7 — Testing & API Client (depends on all)
23. Unit tests: parsers (with sample fixture xlsx), auth service, experiments optimistic-lock logic.
24. e2e tests (supertest): login → create project → create experiment → upload sample xlsx → query data → submit review.
25. `requests.http` collection at repo root covering all endpoints with `{{token}}` variable.
26. README update: monorepo layout, setup/run/test instructions (pnpm + turbo), env vars, architecture overview.

## Relevant files (to be created)
- `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, root `package.json` — monorepo tooling
- `packages/shared/src/**` — enums, DTO interfaces, API contract (consumed by backend + future frontend)
- `apps/frontend/**` — reserved placeholder (package.json, tsconfig, README, src/index.ts)
- `apps/backend/src/entities/*.entity.ts` — 15 TypeORM entities, camelCase columns, `jsonb` for JSONB fields
- `apps/backend/src/config/typeorm.config.ts` — `TypeOrmModuleOptionsFactory` (entities, migrations, synchronize=false)
- `apps/backend/data-source.ts` — standalone DataSource for CLI (migrations, seed)
- `apps/backend/src/auth/auth.service.ts` — `validateUser`, `login` (JWT sign)
- `apps/backend/src/auth/strategies/jwt.strategy.ts` — extracts user from token
- `apps/backend/src/common/guards/roles.guard.ts` — RBAC enforcement
- `apps/backend/src/experiments/experiments.service.ts` — optimistic lock + `versionHistory` snapshot write
- `apps/backend/src/data/parsers/calendar-life.parser.ts` — most complex; 4 fallback rules
- `apps/backend/src/data/parsers/parser.registry.ts` — sheet→parser dispatch
- `apps/backend/src/data/data.controller.ts` — upload + query endpoints
- `apps/backend/src/seed.ts` — roles, demo users, sample data (uses DataSource)
- `apps/backend/src/migrations/*.ts` — TypeORM migrations
- `requests.http` (root) — API client collection
- `apps/backend/.env`, root `.env.example`, `apps/backend/package.json`, `apps/backend/tsconfig.json`, `apps/backend/nest-cli.json`

## Verification
1. `pnpm install` links workspaces (`@eln/shared` resolvable from `apps/backend` and `apps/frontend`).
2. `pnpm --filter @eln/backend run typeorm:run` succeeds; `\dt` in psql shows 15 tables with camelCase columns.
3. `pnpm --filter @eln/backend run seed` populates roles + 2 users + 1 project + 1 experiment.
4. `pnpm run build` (turbo) compiles `packages/shared` then `apps/backend` with no errors; `pnpm run lint` clean.
5. `pnpm run test` — unit tests pass (parsers, auth, optimistic lock).
6. `pnpm run test:e2e` — full flow: login → projects → experiment → upload → query → submit.
7. Manual via `requests.http`: login returns JWT; `GET /users/me` returns role+permissions; upload a sample 7-sheet xlsx and `GET /data/process/:expId` returns parsed rows; calendarLife fallback rules verified on a fixture with missing q_0d.
8. Swagger UI at `/api/docs` lists all endpoints with DTOs.
9. Optimistic lock: concurrent `PUT /experiments/:id` with stale `versionNo` returns 409.
10. `apps/frontend` builds placeholder without error (reserved slot confirmed).

## Scope boundaries
- INCLUDED: monorepo tooling (pnpm workspaces + Turborepo), `packages/shared` (types/DTOs/enums), `apps/backend` (all 15 tables, all API endpoints in §3.1–3.4, Excel ETL with post-processing, RBAC, version history, JWT auth, seed, tests, Swagger), `apps/frontend` reserved placeholder, API client collection at root.
- EXCLUDED (deferred): frontend SPA implementation (slot reserved only), AI gateway real implementation (stubbed 501), OAuth/SSO, file storage to real OSS/S3 (use local disk path in `attachments.filePath`), email notifications, audit log beyond versionHistory.
- ASSUMPTIONS: single-tenant deployment for now (departmentId on users is free-form, no departments table); Excel files are trusted (no malicious-sheet hardening in MVP); `attachments.filePath` stores local `./uploads/<uuid>-<name>`; `synchronize: false` always (migrations are source of truth); frontend framework (React/Vue) to be decided when frontend is implemented — `packages/shared` is framework-agnostic so it won't need rework.

## Further Considerations
1. File storage: local disk vs S3-compatible (MinIO). Recommend local disk for MVP, abstract behind a `FileStorageService` interface so S3 can be added later.
2. TypeORM column naming: keep camelCase columns (TypeORM default uses property names) to match spec exactly. No custom NamingStrategy needed.
3. UUID strategy: `@PrimaryGeneratedColumn('uuid')` (DB-generated) vs `@PrimaryColumn({type:'uuid'})` + app `uuid()`. Recommend app-generated for deterministic seeds/tests.
4. Migrations vs synchronize: always `synchronize: false`; use generated migrations. Dev convenience: a `pnpm --filter @eln/backend run typeorm:sync` script with `synchronize: true` for rapid prototyping only (never in prod).
5. Excel fixture files: need sample .xlsx for each of the 7 business tables to develop/test parsers. Recommend asking user to provide, or generate synthetic fixtures in seed/test.
6. Frontend framework choice: when `apps/frontend` is implemented, recommend Vite + React + TanStack Query (consumes `@eln/shared` types). The shared package keeps the API contract in sync. Alternatively Vue 3 + Vite if preferred.
7. Monorepo publish: `packages/shared` is internal-only (no npm publish); use `workspace:*` protocol. If a separate Python AI service is added later, place it under `apps/ai-service/` (Python, outside pnpm workspace) or `services/`.
