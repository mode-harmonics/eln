# Frontend review — 2026-09-23

> 最终状态以 [修复汇总](2026-09-23-review.md) 为准：后续授权修复已完成，HTTP 134/134、后端 193、前端 6、E2E 9 项通过。下文保留各轮审查记录，早期“未修复”描述不是当前状态。

Scope: routed pages, shared forms/dialogs/tables, JSON client, workflow and upload flows, permission consumers, source-level API comparisons. Product/admin application; existing UI preserved. Read AGENTS.md, frontend-design, frontend-design-premium and verification/anti-pattern references. No DESIGN.md or premium-ui.json found; intentionally not created for this review. Parent-authorized bounded fixes were applied as marked below. No database mutation or browser/server launch by this reviewer.

## Verified fixes

### F01 [P2] Clear-search submitted the previous query — FIXED

- Source: `apps/frontend/src/components/SearchInput.tsx:54`; consumers `pages/Projects.tsx:292`, `pages/Users.tsx:171`, `pages/Roles.tsx:243`, `pages/Inventory.tsx:150`.
- Trigger: enter and submit a filter, then click X. Previously `onChange("")` queued React state while the same event's `onSubmit()` closure still read the previous searchInput. The text cleared but the result filter stayed active.
- Fix: submit callback takes an explicit string; normal submit passes the current value and clear passes an empty string; all four consumers use that argument. Pagination reset behavior preserved.
- Validation: frontend TypeScript and production build pass after fix. Browser behavior not exercised by this reviewer.

### F02 [P2] Inventory controls used the wrong permission — FIXED

- Source: `apps/frontend/src/pages/Inventory.tsx:155`, 175, 210, 234, 279. Backend authority: `apps/backend/src/inventory/inventory.controller.ts:38`, 45, 52 (`system:write`).
- Trigger: account with `system:read` + `system:write` but no `data:write` could open inventory yet had no add/edit/delete controls. Conversely, a data writer lacking system write was offered operations that returned 403.
- Fix: all inventory mutation visibility gates now use `system:write`, matching the controller. Server authorization is unchanged.
- Validation: frontend TypeScript and production build pass; role-matrix browser test still needed.

## Remaining concrete findings

### F03 [P1] Same-route navigation keeps the previous experiment as the edit target — FIXED

- Source: `apps/frontend/src/pages/ExperimentDetail.tsx:48-52`, write target at 216; sibling `pages/ProjectDetail.tsx:27-28`. Router route has no key at `App.tsx:84-85`.
- Trigger: while viewing experiment A, follow a workflow notification to experiment B without leaving the experiment-detail route. React Router updates params/loader data while reusing the component. `useState(loaderData)` runs only on initial mount; no effect synchronizes it to the new experiment ID.
- Impact: URL and loader-based breadcrumb identify B, while title/table/export/edit and upload use A. A user intending to modify B can modify A. Same issue in ProjectDetail produces A's header alongside B's freshly fetched workflow/data.
- Fix direction: make loader result authoritative or remount/reset all route-scoped state by resource ID; reset drawers, raw-data cache and completion state too. Keep hooks unconditional if replacing local state (currently there are hooks after error returns).
- Evidence: source tracing; runtime repro outstanding. Use existing notifications containing both projectId and experimentId to test without inserting data.

### F04 [P2] New-comment notifications navigate to a route that does not exist — FIXED IN FOLLOW-UP

- Source: `apps/frontend/src/components/NotificationBell.tsx:73-83`; `apps/backend/src/experiments/experiments.service.ts:539-544`; `apps/frontend/src/App.tsx:84`.
- Trigger: click an existing NEW_COMMENT notification. Backend payload has commentPreview and relatedExperimentId but no projectId; frontend fallback navigates to `/experiments/:id`. Router registers experiments only under `/projects/:projectId/experiments/:experimentId`.
- Impact: standard comment notifications open React Router's unmatched-route error instead of the commented experiment.
- Fix direction: include projectId in notification payload or resolve experiment.projectId before navigating; optionally provide a supported resolving route for older notifications.
- Evidence: producer and consumer contract mismatch; no new comment posted in this review.

### F05 [P2] Invalid credentials reload the login page instead of keeping its error — FIXED

- Source: `apps/frontend/src/lib/api.ts:36-40`; `apps/frontend/src/pages/Login.tsx:27-46`.
- Trigger: submit incorrect credentials. The generic client handles every 401 by assigning `window.location.href = '/login'`, including the login endpoint itself.
- Impact: full page reload discards the input/error state; Login's intended invalid-credentials message cannot remain visible. The same policy also interrupts editable content immediately when a background request expires.
- Fix direction: distinguish authentication requests from expired protected sessions; let Login own login failures. Preserve the existing protected-session policy until a deliberate session-recovery design is agreed.
- Evidence: deterministic call path; browser repro outstanding.

### F06 [P2] Project data loading can remain pending forever after a failed request — FIXED

- Source: `apps/frontend/src/pages/ProjectDetail.tsx:85-87`, 139-141.
- Trigger: project detail loaded successfully, then `/projects/:id/experiments` fails while opening Summary or Raw Data.
- Impact: `dataLoading` becomes true, but the top-level rejection is swallowed; clearing loading occurs only in a nested success branch. Users see a permanent skeleton, with no error or retry.
- Fix direction: await the complete request tree, clear loading in a shared finally, and expose a retryable error. Also clear loading on unexpected non-array results.
- Evidence: complete promise-chain inspection; network-failure browser test outstanding.

### F07 [P2] Failed assay requests are displayed as complete empty/partial laboratory data — FIXED IN FOLLOW-UP

- Source: `apps/frontend/src/pages/ProjectDetail.tsx:113`, 135-136.
- Trigger: one experiment's assay request returns 403/500 or a network error while other requests succeed.
- Impact: its rejection is converted to `[]`; the type is marked loaded and summaries/charts use only the surviving rows. No partial-failure indication distinguishes missing measurements from an actually empty dataset, potentially misleading comparison of groups.
- Fix direction: retain per-type/per-experiment failure state, present partial data explicitly, and offer retry; do not represent access denial as zero measurements.
- Evidence: source-level failure-path tracing. This is separate from F06, where the initial request never finishes the loading state.

### F08 [P2] Project creation can leave an orphan and create another on retry — FIXED IN FOLLOW-UP

- Source: `apps/frontend/src/pages/Projects.tsx:165-168`, 221-225, 240-243.
- Trigger: project POST succeeds, subsequent workflow-instance POST fails (e.g. permission denial, stale template or transient network failure), then user retries Save.
- Impact: the created project ID is discarded in the catch path. Modal remains with the same input; retry POSTs a new project rather than completing the original workflow. The first project remains without its intended workflow.
- Fix direction: use an atomic backend create-with-workflow endpoint, or retain created ID and resume/reconcile only the failed workflow step. Do not simply retry the whole two-request sequence.
- Evidence: two non-atomic mutations and catch/retry control flow. No project created by this reviewer.

### F09 [P2] Auto-selection reports synchronization success even when synchronization fails — FIXED IN FOLLOW-UP

- Source: `apps/frontend/src/pages/CellPickerPage.tsx:174-177`.
- Trigger: automatic picking succeeds but `/data/sync-cells/:projectId` returns an error.
- Impact: empty catch suppresses it, reload runs, and the UI displays auto_assign_synced success even though downstream test rows may not exist or may retain old assignments. Manual save similarly hides workflow-transition failure at 188, and design submission hides it at `ExperimentDesign.tsx:199-203`.
- Fix direction: distinguish assignment saved, synchronization completed and workflow advanced; retain retryable partial-completion state and suppress unconditional final success on failed required stages.
- Evidence: source tracing; no state-changing API request executed.

### F10 [P2] Inventory create has no pending lock and permits duplicate records — FIXED IN FOLLOW-UP

- Source: `apps/frontend/src/pages/Inventory.tsx:59-86`, submit button 310. Related unguarded user create/update handlers at `pages/Users.tsx:83-107`, 110-139.
- Trigger: double-click Add Item or press submit again while the request is slow.
- Impact: multiple POSTs run concurrently. Inventory has no client pending state or uniqueness key; both can create records for the same intended item. The user-create variant may instead produce a uniqueness failure after one request succeeds.
- Fix direction: add a synchronous submission guard and pending/disabled button state; keep close/cancel behavior explicit during mutations.
- Evidence: source inspection. No duplicate inventory record created during review.

### F11 [P2] Temporary-files modal leaves keyboard focus behind the overlay — FIXED IN FOLLOW-UP

- Source: `apps/frontend/src/components/TempUploadDrawer.tsx:180-191`; shared working mechanism exists in `components/useDialogA11y.ts:12-82` and Drawer.
- Trigger: open the top-level temporary upload drawer using keyboard, then press Tab/Shift+Tab or Escape.
- Impact: it claims aria-modal but does not move/trap/restore focus, isolate the background, lock scroll or handle Escape. Keyboard users can tab into covered background actions instead of the file controls.
- Fix direction: reuse Drawer and its existing focus behavior; ensure the background is inert and modal keyboard semantics match the shared component.
- Evidence: independent custom modal markup and absence of keyboard/focus hook. Browser keyboard/mobile check outstanding.

### F12 [P2] Inventory search/page requests can overwrite newer results — FIXED IN FOLLOW-UP

- Source: `apps/frontend/src/pages/Inventory.tsx:37-56`.
- Trigger: change search or page while an earlier request is still pending; earlier response arrives last.
- Impact: setItems/setTotalItems blindly accept old response while current filter/page controls indicate the new request. Loading can also clear when only the obsolete request finished. Nearby Projects/Users effects already use cancellation flags.
- Fix direction: guard results by request identity or effect cleanup; clear error on retry/success.
- Evidence: source comparison with sibling request effects. GlobalSearch has the same race but is currently unreferenced, so it is not counted as an active-product finding.

## Verification and static audit

- `pnpm --filter @eln/frontend run lint`: PASS before fixes and after fixes (tsc --noEmit).
- `pnpm --filter @eln/frontend run build`: PASS before and after. Post-fix Vite: 3,025 modules; JS bundle 1,527.80 kB (449.91 kB gzip); warning for chunks >500 kB. This is a performance risk, not a build failure.
- `git diff --check`: PASS; Windows LF/CRLF conversion warnings only.
- No frontend unit test framework exists in repository scripts; no new test framework introduced for these small changes.
- Strict premium audit against repository root returned 246 errors but included historical `.worktrees` sources; this total is not used as the live application score.
- Strict premium audit scoped to `apps/frontend` returned 40 findings. Full JSON captured at local temporary path `%TEMP%/eln-frontend-static-audit.json`; durable condensed JSON evidence below. Findings are heuristic signals, not 40 independently verified product bugs: actionless-button checks include valid external-form submit buttons and native-select ownership is documentation debt. No design rewrite performed.

```json
{
  "command": "python <frontend-design-premium>/scripts/audit_project.py apps/frontend --mode strict",
  "mode": "strict",
  "summary": { "errors": 40, "total": 40, "unresolved": 6, "violations": 34, "warnings": 0 },
  "byRule": {
    "affordance.actionless-button": 14,
    "affordance.empty-href": 2,
    "form.novalidate-missing": 12,
    "form.textarea-resize-missing": 6,
    "ownership.native-select-undecided": 6
  }
}
```

## Parent browser follow-up priorities

1. Search Projects by existing text, clear via X, confirm complete results and page one. Repeat one sibling list.
2. Open experiment A then use an existing notification to B; compare address, breadcrumb, heading and upload/edit target without submitting changes (F03).
3. Click existing comment notification (F04); wrong-password login (F05).
4. Fault-inject GET-only failures for project summary initial request and one child assay request (F06/F07).
5. Keyboard-open temporary-files drawer; Tab/Shift+Tab/Escape, narrow viewport and scroll behavior (F11).
6. Inventory access with separate system:write and data:write role combinations (F02); no mutation required.

Limitations: this reviewer performed static/source and build checks only; no claims of measured contrast, mobile geometry, full keyboard conformance, real upload success, concurrency stress, or browser pass. Unfixed issues remain until explicitly implemented and revalidated.

## Authorized follow-up fixes and final scope

- F03: `App.tsx:20-28` now wraps ProjectDetail/ExperimentDetail with resource-ID keys. This forces a clean state when the parameter changes. The route tree and loader ownership are unchanged: project loader remains ID `project`, and useLoaderData in ExperimentDetail still resolves its enclosing experiment route. This deliberately resets all drawers, raw cache and completion flags when changing experiment.
- F05: `lib/api.ts:36` excludes only `/api/v1/auth/login` from protected-session 401 redirection, letting Login render its existing invalid-credentials message. Protected JSON and upload 401 redirects remain unchanged.
- F06: `pages/ProjectDetail.tsx:87-148` chains the entire async load into a shared catch/finally, handles invalid initial response shape, resets error before retry, and ignores cancelled requests. An inline error with localized Retry button is displayed on either data tab at 236-240. Existing F07 child-request partial-data masking remains unfixed.
- Inventory quantity placeholder at `pages/Inventory.tsx:330` changed from a unit-suffixed string incompatible with the API decimal field to `e.g. 500`; numeric keyboard hint added. No unit model invented. Parent owns corresponding backend validation.
- Added English/Chinese Retry strings in `i18n.ts`.
- Existing unsaved-navigation loss remains: these pages have no leave guard or draft persistence; keyed remount prevents editing the wrong resource, but navigating away while editing still discards a draft. This was not broadened into a navigation/draft redesign.
- Final frontend scope: `App.tsx`, `i18n.ts`, `lib/api.ts`, `components/SearchInput.tsx`, `pages/Inventory.tsx`, `pages/Projects.tsx`, `pages/Users.tsx`, `pages/Roles.tsx`, `pages/ProjectDetail.tsx`.
- TypeScript and production build pass after route/login/load-error changes. Latest measured bundle before adding the two translation strings: 1,528.43 kB JS / 450.09 kB gzip. Parent browser checks remain required for real route switching and load-error retry.
Final recheck including translations: frontend lint PASS; frontend build PASS, 3,025 modules, JS 1,528.46 kB / 450.11 kB gzip; only chunk-size warning.

## Final independent compatibility review and parent browser evidence

Reviewed the current frontend diff plus new inventory/user/project DTOs. Normal UI payloads remain compatible: inventory quantity is a decimal string, create timestamp serializes as ISO, blank optional email is accepted for clearing, role IDs are UUIDs, and project edit uses valid Active/Archived values. No additional regression found in keyed wrappers: they do not add route levels or change loader context. Full same-route browser navigation is still outstanding.

Browser evidence supplied by the parent reviewer (not personally rerun here): wrong-password login retains its error; searching Projects for an existing project name yields one result, then clear restores all; seeded project summary renders seven types. These cover F01 and F05 at runtime and the successful F06 data-load path. Error/retry and same-route navigation remain unverified at runtime.

### F13 [P2] User-management mutation gates mismatched server authorization — FIXED

`pages/Users.tsx:179`, 204, 245, 274 gated mutations with users:write whereas UsersController requires system:write. Changed every gate to system:write; server authorization unchanged. The same role matrix consequences as F02 applied. Normal frontend payloads remain accepted by the new decorated DTOs.

### F14 [P2] Experiment controls offered edits forbidden by the new lifecycle lock — FIXED

`pages/ExperimentDetail.tsx:280` previously treated only completed workflow/Scrapped as read-only. The reviewed server now allows experiment update only in Draft. The UI read-only condition now includes any non-Draft status; this passes into all assay tables at 367, suppresses edit/import/complete controls, guards metadata save, and closes the edit modal when read-only. The completed-step badge remains tied to actual stepCompleted, avoiding a false completed claim for In Review. These are bounded alignment changes, not a workflow redesign.

### F15 [P2] Project icon actions have no accessible names — FIXED IN FOLLOW-UP

Source `pages/Projects.tsx:351`, 357. Edit/delete buttons contain only Lucide SVG icons and have no aria-label or text. Parent accessibility-tree check confirmed unnamed buttons. Screen-reader users cannot distinguish edit from delete. Add localized object-specific accessible names, preferably with visible tooltips. No fix applied in this limited pass.

Parent observed strongly compressed project-list columns near 610 px viewport width. Shared table has min-w-full but no meaningful content width floor (`components/Table.tsx:13`), while date/content cells permit wrapping. Treat this as confirmed narrow-layout usability risk; a follow-up should set an appropriate table-local minimum width/overflow or responsive row layout and verify all actions remain reachable. No broad table redesign performed.

Final validation after F13/F14: frontend lint PASS; frontend build PASS, 3,025 modules, JS 1,528.47 kB / 450.09 kB gzip; existing chunk-size warning only. No database mutation or extra server launched by this reviewer.

## Remaining-findings remediation — authorized follow-up

The user authorized fixes for remaining report findings. Existing visual identity was retained; `DESIGN.md` records current runtime tokens, shared owners, data/error semantics, native select acceptance and the table-local scrolling contract.

- F04: legacy notification without projectId resolves `/experiments/:id` via API and navigates to its actual project route. Failure uses shared toast; no invalid fallback route is emitted. Newly generated notifications are addressed separately by the backend agent.
- F07: ProjectDetail no longer converts failed assay requests or invalid-code lookup to empty arrays. The whole data tab shows its retryable error instead of presenting partial measurements as a complete result. CellPickerPage similarly stops mutations when prerequisite data fails to load.
- F08: project wizard retains the created project identity after workflow failure, displays recovery text, prevents changing the persisted project's name/template, and reuses the same project on Retry. It checks for an existing workflow before another POST, covering a workflow response lost after server commit. A synchronous lock prevents duplicate create clicks. Pending identity remains in component memory rather than persisting laboratory content. An uncertain *initial project POST* or page reload still needs backend idempotency/durable recovery; this client fix does not claim to solve distributed exactly-once creation.
- F09: automatic cell selection no longer hides sync failure, keeps a pending synchronization state, and retries synchronization without repeating automatic selection. Manual selection and legacy drawer propagate transition failure. Design submission separates saved design from pending workflow transition and offers Retry step submission. Shared `lib/workflow.ts` reads the actual instance's builtInStep metadata, skips an already-completed target, rejects a missing/non-active target and submits its actual `expectedStepName`. Backend agent has added transactional expectedStepName validation; the frontend also passes this precondition from ExperimentDetail. Custom instance templates no longer rely on the default template to identify these steps.
- F10: inventory create/update and user create/update have synchronous request locks and busy submit controls. Dialog cancellation is disabled during these writes. Temporary upload also rejects a second drop while pending.
- F11: TempUploadDrawer now reuses Drawer rather than maintaining independent modal markup. Shared focus hook excludes CSS-hidden fields, isolates application root with inert, handles only the top modal, restores focus/scroll and handles Escape. The existing drawer supplies modal name, initial focus, trap and portal.
- F12: inventory GETs use request generations and cleanup; obsolete responses cannot overwrite current rows/count/loading/error. Retry clears error. Deletion clamps an out-of-range page.
- F15: project and user icon actions have localized object-specific accessible names; inventory delete icons also receive names. Projects table gets a local 760px width floor, preserving readable cells with horizontal scroll at narrow widths instead of squeezing columns. No shared shell height changed.

Validation after final edits:

- `pnpm --filter @eln/frontend run lint`: PASS.
- `pnpm --filter @eln/frontend run build`: PASS; 3,026 modules; JS 1,530.55 kB / 450.71 kB gzip. Existing chunk-size warning remains.
- `pnpm --filter @eln/frontend exec tsx --test tests/workflow.test.ts`: 4/4 PASS. Covers completed-target retry, custom leaf precondition, missing/pending blocking and transition-error propagation, using real helper with mocked API boundary.
- Strict skill static audit remains 40 heuristic findings (6 unresolved ownership, 34 violations), unchanged from baseline. Full JSON is now saved durably in `docs/reviews/2026-09-23-frontend-static-audit.json`. This is not represented as WCAG/runtime certification; broader form/native-validation and heuristic false positives remain outside these scoped bug fixes.
- Browser evidence from the previous pass remains valid for search clearing, wrong-password feedback and successful seven-type summary. New failure/retry flows, drawer keyboard behavior and narrow-table geometry need parent browser verification; this subagent did not operate a browser or mutate shared data.

No generated frontend outputs were edited directly. Backend transactional/domain work belongs to the parent and sibling reviewers. No commit created.

## ACL integration and browser follow-up

- Temporary-file empty state now uses dedicated bilingual no_temp_files text (No temporary files / 暂无临时文件).
- Parent browser verified temporary drawer Tab cycling and Escape. Initial focus restoration landed on BODY for pointer-triggered opening; fixed by passing a stable Layout trigger ref through TempUploadDrawer/Drawer into useDialogA11y rather than relying on document.activeElement. Parent retest confirmed Escape restores the 临时文件 button.
- Independent integration review found procurement-only assignees blocked by the design-first fetch and selection-only assignees blocked by projectAll write authorization. Coordinated backend/domain changes with sibling reviewers.
- ExperimentDesign now loads design and procurement independently with allSettled. A design 403 disables only that tab and allows procurement to load/select without designSubmitted. Other request failures remain retryable errors, not permission/empty states. Row-level and batch mutation visibility aligns with experiments:write plus actual assigned step/project ownership; read-only views cannot enter inline edits.
- CellPickerPage and legacy CellPicker consume the new selection-candidates endpoint instead of enumerating inaccessible experiments/process tables. Only cell ID and six selection metrics (gqd1, gr1, fvg, ku, fq1, fq2) are shown, respecting the backend's minimal projection. Backend reviewers own candidate-domain authorization and controlled synchronization.
- Final lint PASS; production build PASS (3,026 modules; 1,528.61 kB JS / 450.29 kB gzip; existing chunk warning); workflow regression tests 4/4 PASS.
- Procurement-only and selection-only role browser scenarios remain for parent runtime verification against the rebuilt backend. No broad ACL was weakened by the frontend.

### Final design ACL compatibility check

The design panel and transition helper prefer the actual `design` child. Legacy `experiment_design` is accepted only when the workflow response explicitly marks it as a leaf (`isParallelGroup === false`); a modern group cannot be advanced as the design operation. This matches backend child-scope authorization without granting procurement users access to design data. Final verification after this addition: frontend lint and production build passed; workflow focused tests passed 5/5, including legacy-leaf success and parent-group rejection. Existing large bundle warning remains.

### Procurement browser follow-up

Parent verified procurement-only membership: design tab disabled, procurement selected, records loaded and batch editing available despite design 403. Corrected procurement submit copy to dedicated Chinese/English `procurement_submit`; procurement inline save/cancel/edit icons now include action and group in their accessible names, and both validity switches include validity and group. Frontend lint and production build passed after these small follow-ups (existing chunk warning only).

### Project ownership controls and final scoped verification

Project edit/delete controls now require both projects:write and createdBy matching the current user, matching backend owner-only mutation access. The actions cell remains present for column alignment on non-owned rows; opening edit, submitting edits, and delete handlers also enforce this predicate. Workflow assignment creation exists only in the new-project wizard (the creator's own new project); no separate existing-project reassignment UI was found. Final frontend lint and production build passed after the ownership fix (existing chunk warning only). Parent also verified selection-only editor on a custom-pick workflow: six candidate metrics shown, pick + sync + transition succeeded and returned to the project with success feedback.

### Summary import ownership boundary

ProjectDetail now passes explicit canImport = project creator AND experiments:write to ProjectRawData. Only the import input/menu are conditionally rendered, and both file-picker and upload handlers enforce this capability. Existing read/export behavior is unchanged. This reflects the owner-only backend upload-project boundary for imports that can complete the entire workflow. Frontend lint and production build passed after this change; existing bundle-size warning remains.

### Custom workflow route correction

Current workflow metadata now overlays explicit instance builtInStep values on default-template metadata. WorkflowStepList and WorkflowTaskSidebar both consume the same merged map, so custom-pick mapped to battery_selection resolves to the cell-picker panel. Unknown/unmapped custom steps are not guessed. The fetch-time no-auto-experiment decision also uses the received instance mapping to avoid treating special panels as ordinary experiments. Added immutable merge regression covering custom selection/design, overriding stale defaults, and no mapping fallback. Final frontend lint/build passed and workflow tests passed 6/6 (existing chunk warning only).

Parent final browser verification: completed custom-pick link now resolves to /cell-picker using actual instance mapping; selection confirmation succeeded and the workflow displayed 1/1 completed. Final frontend tests: 6/6.
