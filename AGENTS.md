# ELN — Electronic Lab Notebook

> Production-grade ELN backend for battery-science labs + SPA frontend.
> See [README.md](./README.md) for setup guide and [BACKEND_SPEC.md](./BACKEND_SPEC.md) for the full table/endpoint specification.

---

## Quick start

```bash
pnpm install                    # install all workspace deps
pnpm --filter @eln/backend run typeorm:run   # run DB migrations
pnpm --filter @eln/backend run seed          # seed demo data
pnpm run dev                    # start backend (Turbo watch mode)
pnpm run test                   # unit tests
pnpm run test:e2e               # e2e tests (requires Postgres + seed)
```

---

## Monorepo structure

```
eln/
├─ apps/
│  ├─ backend/     # NestJS + TypeORM + PostgreSQL API server
│  └─ frontend/    # React 19 + Vite + Tailwind 4 SPA
├─ packages/
│  └─ shared/      # @eln/shared — enums, DTOs, API route constants
├─ AGENTS.md       # ← this file
├─ BACKEND_SPEC.md # Full table + endpoint specification (Chinese)
└─ README.md       # Setup & usage guide
```

---

## Backend conventions (NestJS + TypeORM)

### Entity patterns
- **UUID primary keys** — `@PrimaryColumn({ type: 'uuid' })`, generated via `v4 as uuid` in service layer
- **camelCase column names** — explicit `name` in `@Column({ name: 'camelCase' })`
- **Chinese comments** — all entities/tables have `comment: '中文表名'`
- **Logical FKs** — no physical foreign key constraints; use `@Index()` on FK columns for query performance
- **Relations** — use `@ManyToOne` / `@JoinColumn` sparingly; most lookups are manual via repository
- **Entity barrel** — all entities re-exported from `src/entities/index.ts`

### Auth & security
- **JWT via Bearer token** — `passport-jwt` strategy, token stored in `localStorage('token')`
- **RBAC** — `PermissionsGuard` + `@RequirePermission('resource:action')` decorator
- **401/403** — `JwtAuthGuard` (valid token) → `PermissionsGuard` (has permission)
- **Standard response** — `{ success: true, data: T }` or `{ success: false, statusCode, message }` (see `@eln/shared`)

### API conventions
- **Prefix** — `/api/v1` (from `@eln/shared`'s `API_PREFIX`)
- **Controllers** — `@ApiTags`, `@ApiBearerAuth()`, `@UseGuards(JwtAuthGuard, PermissionsGuard)` per controller class
- **Swagger** — available at `/api/docs`
- **Pagination** — `?page=1&limit=10&search=term` pattern
- **Optimistic locking** — `Experiment.versionNo`; PUT rejects stale versions with HTTP 409
- **Validation** — `class-validator` DTOs with `whitelist: true, forbidNonWhitelisted: true`

### Data / ETL pipeline
- Excel upload → 7 parsers → bulk insert in transaction (`DataService.uploadWorkbook`)
- Parser registry resolves sheet names to parsers (`apps/backend/src/data/parsers/`)
- 7 business tables: ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle
- CalendarLife has 4 post-processing fallback rules (see `BACKEND_SPEC.md` §二.10)
- TypeORM entity mapping: `TABLE_NAME_TO_ENTITY` / `TYPE_PARAM_TO_ENTITY` in `DataService`

### Testing
- **Jest + ts-jest** — files match `*.spec.ts`
- **Module alias** — `@eln/shared` maps to `<rootDir>/../../packages/shared/src`
- **E2e** — `test/` folder, requires running Postgres + seed data
- Test files co-located in `__tests__/` folders

---

## Frontend conventions (React 19 + Vite + Tailwind 4)

### Tech stack
- **React 19** — functional components, hooks
- **Vite 6** — dev server on port 5173, proxy `/api` → backend `localhost:3000`
- **Tailwind CSS 4** — `@tailwindcss/vite` plugin, utility-first
- **React Router 7** — nested routes with `<Layout>` + `<Outlet>`
- **i18next** — Chinese/English, auto-detected via `i18next-browser-languagedetector`
- **lucide-react** — icon library
- **recharts** — data visualization for battery experiment charts
- **date-fns** — date formatting
- **clsx + tailwind-merge** — `cn()` utility for conditional class merging

### Project patterns
- **API client** — custom `api.get/post/put/delete` in `src/lib/api.ts`, reads JWT from `localStorage('token')`, auto-redirects on 401
- **Types** — `src/types.ts` re-exports from `@eln/shared` DTOs
- **Pages** — `src/pages/` directory, one file per route
- **Components** — `src/components/` shared UI library (Button, Modal, Pagination, etc.)
- **Hooks** — `src/hooks/` (usePermissions, useViewMode)
- **Auth** — `ProtectedRoute` wrapper checks `localStorage('auth') === 'true'`
- **Permissions** — `usePermissions().hasPermission('resource:action')` controls UI visibility

### UI conventions
- Color: `#1d74f5` primary blue
- Button variants: primary / secondary / danger / ghost / text
- Modal: Escape to close, backdrop blur
- Pages use `useTranslation()` from `react-i18next` for i18n
- Table components in `ExperimentTables.tsx` for each battery data type

### Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/login` | `Login` | Auth page |
| `/projects` | `Projects` | Project list |
| `/projects/:projectId` | `ProjectDetail` | Single project + experiments |
| `/experiments/:experimentId` | `ExperimentDetail` | Experiment with data tables/charts |
| `/inventory` | `Inventory` | Lab inventory |
| `/users` | `Users` | User management (admin) |
| `/roles` | `Roles` | Role management (admin) |
| `/profile` | `Profile` | Current user profile |

---

## Shared package (@eln/shared)

Single source of truth for:
- **Enums** — `RoleName`, `ExperimentStatus`, `ProjectStatus`, `InventoryStatus`, `DataType`
- **API routes** — `API_PREFIX`, `API_ROUTES` constants (backend + frontend use these)
- **DTOs** — framework-agnostic interfaces for all entities (mirrors TypeORM entities)
- **Response types** — `ApiSuccessResponse<T>`, `ApiErrorResponse`, `ApiResponse<T>`

---

## Key entity relationships

```
User (roleId → Role)
Project (createdBy → User)
  └── Experiment (projectId → Project, createdBy → User)
       ├── Attachment (experimentId → Experiment)
       ├── ExperimentCollaborator (experimentId → Experiment, userId → User)
       ├── VersionHistory (experimentId → Experiment, updatedBy → User)
       ├── ProcessData (experimentId → Experiment)
       ├── CalendarLife (experimentId → Experiment)
       ├── StorageSwelling (experimentId → Experiment)
       ├── EnergyEfficiency (experimentId → Experiment)
       ├── DcrTest (experimentId → Experiment)
       ├── FastCharge (experimentId → Experiment)
       └── HtCycle (experimentId → Experiment)
```

---

## Common pitfalls

1. **Entity `@Column` naming** — Always use explicit `name: 'camelCaseName'` to match the DB column convention; TypeORM defaults to snake_case
2. **DTO vs Entity** — Backend DTOs use `class-validator` decorators; shared DTOs are plain TypeScript `interface`s (no decorators)
3. **E2e tests** — Require a real Postgres database with seed data; not suitable for CI without DB service
4. **Module alias** — Backend tsconfig maps `@eln/shared` to `../../packages/shared/dist` (pre-built); Jest config maps to `src` directly
5. **Decimal columns** — TypeORM returns `string | null` for `decimal` type columns, not `number`
