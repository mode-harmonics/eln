# ELN Agent Guide

ELN is a pnpm/Turbo monorepo for a battery-lab electronic notebook. Use [README.md](./README.md) for setup and product context. Treat [BACKEND_SPEC.md](./BACKEND_SPEC.md) as the original backend contract; verify current behavior in source because the application has grown beyond that specification.

## Workspace Boundaries

- `apps/backend`: NestJS, TypeORM, and PostgreSQL API. Controllers own HTTP/auth concerns; services own persistence, transactions, workflow checks, and derived values.
- `apps/frontend`: React 19 and Vite SPA. [App.tsx](./apps/frontend/src/App.tsx) owns routing/loaders; pages own requests and mutation state; `components/` is the shared UI layer.
- `packages/shared`: framework-independent API routes, enums, DTO interfaces, response types, colors, and workflow contracts. Put cross-application contracts here, then update both consumers.
- Do not edit generated `dist/`, `build/`, coverage, Turbo cache, or TypeScript build-info artifacts.

## Setup And Commands

Requires Node 20+ and pnpm 9.12.0. Run commands from the repository root.

```bash
pnpm install
pnpm --filter @eln/backend run typeorm:run
pnpm --filter @eln/backend run seed
pnpm run dev
```

`pnpm run dev` starts backend, frontend, and shared watch tasks. Backend environment files live at `apps/backend/env/<name>.env`; local runtime defaults to `env/local.env`. Start from `apps/backend/env/example.env`.

Prefer the narrowest validation that covers the change:

```bash
# Shared contracts
pnpm --filter @eln/shared run type-check
pnpm --filter @eln/shared run build

# Backend
pnpm --filter @eln/backend run type-check
pnpm --filter @eln/backend run test -- --runInBand
pnpm --filter @eln/backend exec jest <path-to-spec> --runInBand
pnpm --filter @eln/backend run build

# Frontend ("lint" is tsc --noEmit; there are no frontend unit tests)
pnpm --filter @eln/frontend run lint
pnpm --filter @eln/frontend run build

# Dependency-ordered workspace checks
pnpm run build
pnpm run test
```

On a clean tree, build `@eln/shared` before backend-only compilation; backend TypeScript resolves the package's generated `dist`, while Jest resolves shared source directly. Root Turbo `build`, `lint`, and `test` handle upstream build ordering.

Do not use `pnpm run lint` as a read-only check: the backend lint script runs ESLint with `--fix`. Root `type-check` does not check the frontend; use the frontend `lint` script above.

E2e tests require PostgreSQL plus migrated and seeded test data. They do not automatically load `apps/backend/env/test.env`; provide the intended environment to the process before running:

```bash
pnpm --filter @eln/backend run typeorm:run:test
pnpm --filter @eln/backend run seed:test
pnpm --filter @eln/backend run test:e2e
```

## Backend Rules

- Use migrations for schema changes. Runtime and CLI TypeORM configurations keep `synchronize: false`.
- Follow existing entity patterns: UUID primary columns, explicit camel-case database column names, Chinese table/column comments, indexed logical FK columns, and exports from [entities/index.ts](./apps/backend/src/entities/index.ts). Do not introduce physical FK constraints unless the schema strategy is intentionally changed.
- TypeORM decimal fields are `string | null`; parser outputs also serialize decimal-like values as strings. Do not silently convert these contracts to numbers.
- Request DTOs are decorated classes under each module's `dto/`; shared DTOs are plain TypeScript interfaces and cannot provide runtime validation. The global validation pipe rejects non-whitelisted fields.
- Secure endpoints with both `JwtAuthGuard` and the appropriate permission check. `PermissionsGuard` only authorizes when `@RequirePermission` metadata exists; dynamic permissions need an explicit check such as those in [data.controller.ts](./apps/backend/src/data/data.controller.ts).
- Keep application-managed optimistic locking intact: compare `versionNo`, reject stale writes with 409, increment it, and preserve version-history behavior.
- Parser registry order is significant because matching is first-win. A new uploaded data type usually needs coordinated parser registration, entity exports/module registration, and mappings in [data.service.ts](./apps/backend/src/data/data.service.ts).
- Preserve the standard API envelope and exception shape implemented in [all-exceptions.filter.ts](./apps/backend/src/common/filters/all-exceptions.filter.ts).

## Frontend Rules

- Use [api.ts](./apps/frontend/src/lib/api.ts) for JSON API calls; it attaches JWT credentials, unwraps successful envelopes, and normalizes errors. Use `api.upload` for multipart data so the browser supplies the boundary. Authenticated binary downloads are the valid direct-`fetch` exception.
- Reuse domain types through [types.ts](./apps/frontend/src/types.ts) and `@eln/shared`; add frontend-only response extensions there instead of duplicating backend contracts.
- Register routed pages and breadcrumb metadata in [App.tsx](./apps/frontend/src/App.tsx). Preserve loader IDs used by nested pages.
- Gate mutation controls with `usePermissions().hasPermission('resource:action')`, but never treat UI visibility as authorization; the backend remains the security boundary.
- Authentication uses both `localStorage('auth')` for protected routing and `localStorage('token')` for requests. Permission updates in the same tab must dispatch the existing `permissionsChanged` event.
- Compose Tailwind classes with `cn()` and reuse tokens from [index.css](./apps/frontend/src/index.css), existing controls, and Lucide icons. Match the established interface instead of introducing a parallel component style.
- Effects run twice in development under React StrictMode. Make request effects abortable or otherwise idempotent, following nearby page patterns.
- The frontend TypeScript check covers `src` but not `vite.config.ts`; run the production build after configuration or dependency changes.

## Change Discipline

- Keep changes inside the owning package unless a contract genuinely crosses package boundaries.
- Search for a neighboring implementation and focused spec before adding an abstraction.
- Never commit secrets or local environment files. Avoid logging JWTs, database URLs, uploaded workbook contents, or lab data.
- Add focused Jest coverage for backend behavior changes. For frontend changes, type-check and build at minimum, then exercise the affected route when a dev environment is available.
