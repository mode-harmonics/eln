# Backend source review — 2026-09-23

> 最终状态以 [修复汇总](2026-09-23-review.md) 为准：后续授权修复已完成，HTTP 134/134、后端 193、前端 6、E2E 9 项通过。下文保留各轮审查记录，早期“未修复”描述不是当前状态。

Final integration note: the sections below preserve findings against the original source. Parent changes have now fixed password-hash exposure, temporary-file ownership, Draft-only experiment editing and atomic edit/history writes; HTTP regressions confirm those paths. Project/step authorization, batch completed-step protection, deletion lifecycle and search/dashboard scoping remain open. The authoritative final status and HTTP counts are in [2026-09-23-review.md](2026-09-23-review.md). Line numbers below may refer to pre-fix source.

Scope: auth, users/roles, projects/experiments, data, workflow, inventory, procurement, design, and temporary files. Findings below are source-confirmed; this reviewer did not modify the database or run HTTP mutations. Parent review owns independent HTTP evidence. Priorities: P1 high, P2 medium. Paths are repository-relative.

## P1 — Project responses disclose creator password hashes

`apps/backend/src/projects/projects.service.ts:33` joins the complete creator; line 178 also loads that relation for details, and progress enrichment spreads the entire project. `apps/backend/src/entities/user.entity.ts:29` selects and serializes passwordHash by default. No global serializer removes it. Any reader of a project gets its creator's credential hash, enabling offline guessing. Reproduce with GET `/api/v1/projects` or a visible project's detail and check only the presence of `creator.passwordHash`, never log its value. Use explicit safe user projections/response DTOs and exclude credential columns by default. Confidence: high.

## P1 — Object authorization is missing on nested reads and mutations

`projects.service.ts:198` lists full experiments/attachments without the user membership check present in findOne. `experiments.controller.ts:130` explicitly calls findDetail without user context, bypassing the workflow access checks at `experiments.service.ts:169`. Versions (controller line 120), comments, attachment download and mutation handlers similarly omit object access checks. Project update/delete/members and design/procurement/data routes accept generic experiments permissions without confirming project membership. Reproduce with two users: GET another user's project should return 403, but GET `/projects/:id/experiments`, `/projects/:id/design`, or known experiment `/experiments/:id/attachments` can return data. A writer can also update otherwise inaccessible resources. Centralize project/step access enforcement and pass authenticated context through all entry points, including exports and attachment IDs. Confidence: high; affects confidentiality and integrity.

## P1 — Any experiment writer can grant themselves workflow access

`apps/backend/src/workflow/workflow.service.ts:808-826` updates assignments without actor context. The controller's PUT `/workflow/instances/:projectId/steps/:stepName` requires only experiments:write. An outsider with that generic capability can submit `{ "assignedUserIds": ["their-user-id"] }`, becoming a project member through the same assignments used by visibility checks and acquiring transition authority. Require project-owner/designated administrative authority before reassignment and validate assignee eligibility. Confidence: high.

## P1 — Completed workflow data can be changed through batch/create routes

`apps/backend/src/data/data.service.ts:1442` rejects single-row writes after completion, but `batchUpdateRows` at line 1637 and `createRow` at line 1346 omit that guard. Reproduce on a completed step: single PUT `/data/:type/:rowId` returns 403; PUT `/data/:type/batch` with `{ "rows": [{ "id": "same-row-id", "editableField": "new-value" }] }` reaches persistence. Design deletion at `experiment-design.service.ts:123` also omits the completed-step check used for create/update. Enforce the same lock for every mutation, checking all affected experiments in batch writes. Confidence: high.

## P1 — Review and archive status do not lock experiment edits

`apps/backend/src/experiments/experiments.service.ts:229-247` only checks versionNo before changing title/content/metadata. PUT `/experiments/:id` with the current version still mutates In Review, Approved, and Archived records, contrary to submit's documented lock behavior. Reject edits outside allowed editable statuses and apply equivalent protection to associated data/attachments where required. Confidence: high.

## P1 — Temporary files are globally readable and deletable

`apps/backend/src/temp-files/temp-files.controller.ts:90-116` lists the entire process registry and downloads/deletes by ID without checking uploadedBy. Only a valid login is required. User A uploads a harmless file; user B lists, downloads, and deletes it. Filter list by owner, require owner or an explicit administrative capability for object operations. Confidence: high.

## P2 — Optimistic locking is not atomic

`apps/backend/src/experiments/experiments.service.ts:235-260` reads and compares version, then saves separately and writes history separately. Two concurrent updates can both read N and write N+1 successfully, overwriting content and producing duplicate version numbers. Concurrent edit/submit can similarly overwrite state. Reproduce by simultaneous PUTs with the same version against an isolated fixture; this review did not run the race. Use conditional UPDATE with version predicate (or transactional row lock), check affected row count, and persist history within the same transaction. Confidence: high from control flow; timing-dependent runtime reproduction outstanding.

## P2 — Deleting projects/experiments leaves dependent records behind

`projects.service.ts:317` only removes the project. `experiments.service.ts:267-280` deletes attachments metadata/collaborators/history but leaves business data, comments, and attachment bytes. Application-managed relationships have no physical cascade guarantee. Deletion leaves orphaned laboratory records/files and inconsistent direct data/export results. Enumerate dependencies and delete transactionally; clean files after successful database changes with recoverable cleanup. Confidence: high from explicit deletion paths; isolated database/file fixture recommended.

## Narrow fixes performed during parent-authorized follow-up

Inventory DTOs now whitelist editable properties, constrain lengths/status/date, trim required names/types, and validate non-negative decimal strings up to decimal(18,6), retaining nullable fields. Inventory controller receives real DTO classes; service converts validated lastUsedAt strings to Date. Project create/update DTOs trim and reject blank names and restrict status to ProjectStatus. Tests exercise actual controller parameter metadata and Nest ValidationPipe. These fixes do not address the security findings above.

Validation evidence: before implementation all 14 regression cases failed for the expected accepted-invalid inputs (CLI ts-jest diagnostics temporarily disabled because installed @nestjs/core declaration was unreadable to TypeScript). Following dependency recovery, the standard command `pnpm --filter @eln/backend exec jest src/inventory/inventory-validation.spec.ts --runInBand` passed all 14 tests with no diagnostics overrides. No existing database was modified by this reviewer.
