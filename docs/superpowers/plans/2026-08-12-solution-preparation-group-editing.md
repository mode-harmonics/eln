# Solution Preparation Group Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store one plain-string formula description per solution-preparation group and provide consistent edit/scrap icon actions in the grouped frontend table.

**Architecture:** Add a dedicated `solutionPreparationGroup` entity keyed uniquely by experiment and group name. The data service composes group names from existing solution-preparation detail rows with the optional formula string and scrap state; the React table edits only the group-level string while preserving all detail rows.

**Tech Stack:** TypeScript, NestJS 10, TypeORM/PostgreSQL, Jest, React 19, Vite.

## Global Constraints

- Keep `solutionPreparation` detail rows and `scrappedSolutionGroup` status rows intact.
- Store `formulaInfo` as an opaque plain string; do not parse or split it.
- Keep `synchronize: false`; create a reversible migration for the new table.
- Reuse the existing experiment-table icon styles and permission/read-only behavior.
- Work directly on `main` as explicitly authorized by the user.

---

### Task 1: Group formula persistence and service contract

**Files:**
- Create: `apps/backend/src/entities/solution-preparation-group.entity.ts`
- Create: `apps/backend/src/migrations/1795000000002-CreateSolutionPreparationGroup.ts`
- Create: `apps/backend/src/data/solution-preparation-group.service.spec.ts`
- Modify: `apps/backend/src/entities/index.ts`
- Modify: `apps/backend/src/data/data.service.ts`

**Interfaces:**
- Produces: `getSolutionPreparationGroups(experimentId: string): Promise<Array<{ groupName: string; formulaInfo: string; scrapped: boolean }>>`
- Produces: `updateSolutionPreparationGroup(experimentId: string, groupName: string, formulaInfo: string): Promise<{ groupName: string; formulaInfo: string }>`

- [ ] **Step 1: Write failing service tests**

Create tests proving that an existing group initially returns an empty formula string, ordinary strings are preserved exactly, a second update overwrites the value, and a missing group throws `NotFoundException`. Use repository fakes that model `find`, `findOne`, `exist`, `create`, and `save` behavior and assert returned service behavior rather than mock call counts.

- [ ] **Step 2: Run the focused test and verify RED**

Run the backend Jest binary directly against `src/data/solution-preparation-group.service.spec.ts --runInBand`.

Expected: FAIL because the entity and service methods do not exist.

- [ ] **Step 3: Implement the entity, service methods, and migration**

Add a UUID entity with `experimentId`, `groupName`, nullable text `formulaInfo`, timestamps, a unique `(experimentId, groupName)` constraint, and experiment index. Compose the read response from distinct detail group names, formula metadata, and scrap records. Validate group existence before upserting an update. Create a reversible migration that only creates/drops this new table and indexes.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the focused Jest test again and expect all cases to pass.

### Task 2: HTTP endpoints and shared contract

**Files:**
- Modify: `apps/backend/src/data/data.controller.ts`
- Modify: `packages/shared/src/dto/battery-data.dto.ts`

**Interfaces:**
- Produces: `GET /api/v1/data/solution-preparation-groups/:experimentId`
- Produces: `PATCH /api/v1/data/solution-preparation-groups/:experimentId` with `{ groupName: string; formulaInfo: string }`
- Consumes: the Task 1 service methods.

- [ ] **Step 1: Add the shared response interface**

Add `SolutionPreparationGroupDto` with `groupName: string`, `formulaInfo: string`, and `scrapped: boolean`.

- [ ] **Step 2: Add guarded controller routes**

Add the GET route with data read permission and the PATCH route with data write permission. Validate both body fields as strings through a request DTO class and forward the authenticated request to the Task 1 service methods.

- [ ] **Step 3: Run shared and backend type checks**

Build and type-check `@eln/shared`, then type-check the backend. Expected: zero errors.

### Task 3: Grouped table editing and consistent actions

**Files:**
- Modify: `apps/frontend/src/components/ExperimentTables.tsx`
- Modify: `apps/frontend/src/i18n.ts`

**Interfaces:**
- Consumes: `GET/PATCH /api/v1/data/solution-preparation-groups/:experimentId`.
- Preserves: existing scrap and restore endpoints.

- [ ] **Step 1: Replace material-detail rendering with group DTO state**

Fetch the Task 2 group endpoint for live data. For static data, derive unique group names with empty `formulaInfo`. Render exactly three columns and show `formulaInfo || '-'` in normal state.

- [ ] **Step 2: Add single-line formula editing**

Track `editingGroup`, `editValue`, and `saving`. In edit mode render one full-width `<input type="text">`. Save the string unchanged through PATCH; on success exit edit mode and refresh, and on failure retain the input and show a toast.

- [ ] **Step 3: Align action icons**

Normal groups show the existing gray edit icon and gray-to-red scrap icon with tooltips. Edit mode shows the existing green check and gray cancel icons. Scrapped groups are frozen and only show the amber restore icon. Static/read-only rows show the same non-action placeholder behavior used by the surrounding table.

- [ ] **Step 4: Run frontend checks**

Run frontend TypeScript checking and the Vite production build directly. Expected: both exit 0; the existing chunk-size warning is allowed.

### Task 4: Integrated verification

**Files:**
- Verify all modified and created files.

**Interfaces:**
- Consumes all earlier tasks.
- Produces a verified working tree without staging the user's `demo/demo.zip`.

- [ ] **Step 1: Run backend full verification**

Run all backend Jest suites with `--runInBand`, backend TypeScript checking, and Nest production build. Expected: all tests pass and both compilation commands exit 0.

- [ ] **Step 2: Run shared/frontend verification**

Run shared build/type-check and frontend type-check/build. Expected: exit 0.

- [ ] **Step 3: Check migration and working-tree scope**

Run `git diff --check`, inspect `git status --short`, and confirm `demo/demo.zip` remains untouched and unstaged. If PostgreSQL is available, run and revert the new migration; otherwise report the environmental limitation without connecting to a remote database.
