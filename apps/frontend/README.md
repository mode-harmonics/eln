# @eln/frontend (reserved slot)

**Frontend not yet implemented. See `apps/backend`.**

This package is a placeholder reserved for a future single-page application.
It is scaffolded (valid `package.json` + `tsconfig.json`, resolves
`@eln/shared`) so the monorepo's workspace graph, Turborepo pipeline, and
shared-types contract are all wired correctly today — but no UI code lives
here yet.

## What exists today

- `package.json` — depends on `@eln/shared` via the `workspace:*` protocol.
- `tsconfig.json` — extends the root `tsconfig.base.json`.
- `src/index.ts` — a no-op placeholder entry point.

## What's deferred

- Framework choice (React + Vite + TanStack Query is the current
  recommendation; Vue 3 + Vite is a fine alternative). See
  `BACKEND_SPEC.md`'s "Further Considerations" for the reasoning.
- All UI, routing, state management, and API-client wiring.

## Why it's safe to defer

`packages/shared` (enums, DTOs, API route constants) is framework-agnostic.
Whichever framework is chosen later, the API contract is already pinned
down and won't need rework — only `apps/frontend/src/**` needs to be built
out.

## Once a framework is chosen

1. Replace this `package.json`'s scripts with the real `dev`/`build`/`lint`/`test` commands for that framework.
2. Add the framework + its dependencies.
3. Import types/enums from `@eln/shared` instead of redefining them.
4. Point API calls at the paths in `@eln/shared`'s `API_ROUTES`.