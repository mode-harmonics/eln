# Schema and persistence review — 2026-09-23

> 最终状态以 [修复汇总](2026-09-23-review.md) 为准：后续授权修复已完成，HTTP 134/134、后端 193、前端 6、E2E 9 项通过。下文保留各轮审查记录，早期“未修复”描述不是当前状态。

## Subsequent authorized remediation: state and transaction boundaries

The later request authorized repairing remaining findings. The current implementation supersedes the earlier bounded-fix limitations recorded below:

- Data row create/update/delete, bulk updates, solution-group metadata/scrapping and cell selection now use transaction-bound repositories. Project and experiment locks serialize writes with lifecycle transitions/deletions. Non-Draft and completed/skipped steps reject writes, including summary imports. Batch updates validate every ID before any write, re-read rows after obtaining locks, and save derived sibling values only within the targeted experiments.
- Direct and multi-experiment summary imports now share a file-aware transaction boundary. All database records and derived recomputations commit together; failure removes all newly staged files, while old files are deleted only after commit. The project lock is obtained before reading merge context, preventing stale concurrent imports from overwriting each other. Upload paths respect `UPLOAD_DIR`. Existing completed targets are rejected and roll back the whole summary.
- Workflow creation, advancement, completion and assignment updates now use transaction-bound repositories and notifications. Project locks prevent duplicate workflow creation and race with project deletion. Instance creation and template deletion/graph editing take the same template row lock; referenced templates cannot be deleted or have their graph replaced. `canViewOtherSteps` no longer bypasses role filtering. Transition checks role permission for the chosen leaf and supports `expectedStepName` to reject stale retries. Responses expose builtInStep from the actual instance template.
- Experiment design rows and generated procurement rows commit together. Updates synchronize the procurement molecule name; removal checks design-step completion, rejects designs referenced by measurements, and deletes associated procurement rows atomically. Procurement mutations lock the parent project and check workflow state within the transaction.
- Battery-selection candidates expose only cellId/gqd1/gr1/fvg/ku/fq1/fq2/scrapped, using the same procurement-invalid and scrapped exclusions as automatic selection. Manual selection rejects non-candidates, unsupported test types and duplicate cells. Synchronization inserts placeholders only for new cells and never deletes existing measurements; repeated synchronization is idempotent.

Verification in this agent's workspace: backend type-check passed; latest full Jest run passed **30 suites / 190 tests**. New regression failures were observed before fixes for completed/non-Draft data mutation (7), workflow partial/duplicate/orphan creation (3), design/procurement partial commit (1), procurement on a deleted project (1), and in-use template graph changes (1). Restoring the old destructive sync deletion made the measurement-preservation test fail; restoring the safe implementation passed. Additional tests cover summary rollback across multiple targets, minimal selection projection and invalid-pick preservation. Existing transaction mocks were updated without relaxing assertions. Parent agent owns fresh HTTP/PostgreSQL verification and final consolidated counts.

Filesystem deletion remains best-effort: a denied unlink can leave an unused file, but does not destroy the only old source before commit. No database contents were accessed by this agent.

Initial read-only source review of migrations, entity definitions, datasource registration, and deletion/import/version persistence paths. Following user authorization for bounded fixes, S1 received an atomic overwrite fix, S2 received a transaction/row-lock fix and S5 received a service guard, each with regression tests; this agent did not access or change a database. Other findings below are source-confirmed; concurrent schedules and failure scenarios are reasoned from the implementation, not claimed as live database reproductions. Paths are relative to `C:/Users/lengjing/workspace/code/github/eln/` unless fully qualified. Finding locations below describe the original reviewed code; fix locations can shift them.

## S1 — [P1] Overwrite import destroys the previous dataset before validating the replacement

**Status: fixed for the individual uploadWorkbooks replacement operation.** All workbooks parse and undergo filtering/normalization before disk writes or destructive database changes. Overwrite requests with no recognized business rows are rejected. Attachment/business/raw deletions and replacement inserts share the existing QueryRunner transaction. New files are cleaned up on write/save failures; old files are unlinked only after commit. ProcessData context excludes the current experiment during overwrite while preserving fields from other workflow steps.

- Location: `C:/Users/lengjing/workspace/code/github/eln/apps/backend/src/data/data.service.ts:397` (destructive overwrite block, lines 397–423).
- Trigger: Import a malformed workbook using overwrite mode into an experiment that already has business rows. The code unlinks every existing attachment, deletes their metadata, and deletes all eight business/raw tables before attempting `workbook.xlsx.load` at lines 454–457. That parser throws a 400 on malformed input.
- Impact: A rejected upload permanently removes the original experimental measurements and source files. A later SQL insertion failure has the same loss because the transaction starts only at line 607, after the old records were committed as deletions. Rollback cannot restore those records or unlinked files.
- Fix: Parse and validate all files first; perform replacement deletions and inserts in the same database transaction. Keep old physical files until commit, then remove them, and clean up staged new files on any failure.
- Confidence: High. The order of operations and transaction boundary are explicit.

### S1 verification and limits

- New `apps/backend/src/data/data-upload-overwrite.spec.ts` uses real ExcelJS workbooks and the real ParserRegistry with transaction-aware in-memory database/filesystem I/O doubles. No uploaded laboratory data or actual disk files are involved.
- Initial focused run: **5/5 failed** on the original code, reproducing lost originals after a malformed second workbook and insertion error, empty/unrecognized acceptance, and old-file deletion before commit.
- Final focused command `pnpm --filter @eln/backend exec jest src/data/data-upload-overwrite.spec.ts --runInBand`: **6/6 passed**, including added partial disk-write cleanup. The success case verifies prior-step m0 is kept, newly imported m1 replaces the old value, mIn is recalculated, and omitted current-experiment m2 is not carried forward.
- Latest full backend command `pnpm --filter @eln/backend run test -- --runInBand`: **16 suites / 80 tests passed**, exit 0. `pnpm --filter @eln/backend run type-check` also passes after the parent restored dependencies. These results supersede the temporary concurrent-red-test/dependency failures recorded during S2 work below.
- Summary imports remain separate transactions per target experiment; post-commit derived-field recomputation is unchanged. Existing best-effort unlink behavior can leave unused files if filesystem deletion is denied; it no longer destroys the only original before a replacement has committed. Concurrent imports are not serialized by this bounded change.

## S2 — [P1] Concurrent updates bypass the advertised optimistic lock

**Status: update-versus-update race fixed.** `ExperimentsService.update` now runs in a TypeORM transaction, loads the experiment with `pessimistic_write`, checks Draft status and the expected version under that lock, then writes the experiment and its original-format full audit snapshot using the transaction manager. Non-Draft edits now return 409. This also fixes a separate atomicity defect where a failed history insert previously left the content update committed.

**Remaining boundary:** submit/approve/reject/archive continue to read and save outside this transaction protocol. An edit racing with one of those transitions can still interact with a stale transition read. They were intentionally not changed in this bounded edit-only fix. Parent HTTP testing found In Review editing reproducible; an eight-request HTTP race had only one winner in that run, so the original race is a source-confirmed schedule, not claimed as an observed live lost update.

- Location: `C:/Users/lengjing/workspace/code/github/eln/apps/backend/src/experiments/experiments.service.ts:245` (increment and save, lines 245–247; comparison at 235).
- Trigger: Two editors submit updates with version N concurrently. Both `findOne` calls can read N, both pass the JavaScript comparison, and both save a full entity with version N+1. The generated write is keyed by primary ID, not by the expected version.
- Impact: Both requests succeed; the last writer overwrites the first without the required 409 conflict. Both history records may also claim version N+1, making the audit trail ambiguous. The `versionNo` entity field is a normal column and the migration has no unique `(experimentId, versionNumber)` history constraint to detect this.
- Fix: Use an atomic conditional update (`WHERE id = :id AND versionNo = :expected`) and reject an affected-row count of zero, or acquire a row lock inside a transaction before comparing. Write the resulting history snapshot in that same transaction. Cover a deliberately interleaved two-writer execution.
- Confidence: High. Normal read/compare/save is not an atomic compare-and-swap.

### S2 verification

- New `apps/backend/src/experiments/experiment-update.spec.ts` exercises the real service with transaction-aware in-memory persistence doubles. It asserts the row-lock query contract, committed snapshot/version alignment, rollback when history fails, rejection of In Review/Approved/Archived writes, stale-version rejection and missing-ID behavior.
- Focused command: `pnpm --filter @eln/backend exec jest src/experiments/experiment-update.spec.ts --runInBand`.
- RED: **5 failed / 2 passed**, specifically missing lock, content surviving a history failure, and the three editable non-Draft statuses. GREEN after production change: **7 passed / 7 total**.
- Full backend suite during concurrent parent work: **12 passed suites / 2 failed suites; 55 passed / 5 failed tests**. Failures were the parent's then-in-progress red regressions in `temp-files/temp-files.controller.spec.ts` (three ownership cases) and `users/users-response.spec.ts` (two password-hash response cases); an asynchronous temporary-file ENOENT also appeared. Parent owns their fixes and consolidated rerun.
- Backend type-check was attempted and blocked by TS1127/TS1434/TS1128 at line 1 in installed `@nestjs/core/adapters/http-adapter.d.ts` and `@nestjs/core/index.d.ts` (invalid characters in dependency declarations). No dependency files were changed by this agent.
- No PostgreSQL integration test was run by this agent; parent owns real HTTP/database verification.

## S3 — [P2] Experiment deletion leaves its scientific data and physical uploads behind

- Location: `C:/Users/lengjing/workspace/code/github/eln/apps/backend/src/experiments/experiments.service.ts:273` (cleanup list, lines 273–279).
- Trigger: Delete an experiment containing imported assay rows, solution preparation data, comments, or uploaded files.
- Impact: Only attachment metadata, collaborators, history and the experiment are deleted. Process/assay/raw rows, solutionPreparation, solutionPreparationGroup and experimentComment records remain with an invalid experimentId. The actual files are never unlinked, and deleting their attachment metadata removes the application's cleanup handle. Repeated deletions accumulate unrecoverable orphaned laboratory data and files.
- Evidence: The initial migration only creates physical FKs for user.roleId and project.createdBy (lines 140–141); none of the experiment children can cascade. `deleteAttachment` has an explicit scientific-row/file cleanup implementation at lines 493–513, but `remove` does not call it or provide equivalent cleanup.
- Fix: Implement the complete application-managed cascade in a transaction, with post-commit physical-file cleanup. Include both newer solution preparation tables and comments. Add a deletion integration test that seeds each child category and verifies no children remain.
- Confidence: High.

## S4 — [P2] Project deletion leaves active workflows and all project children

- Location: `C:/Users/lengjing/workspace/code/github/eln/apps/backend/src/projects/projects.service.ts:320`.
- Trigger: Delete a project with experiments and an active workflow.
- Impact: Only the project row is removed; experiments, workflowInstance, workflowStepAssignment, experiment designs, procurements, picked/scrapped cells and their dependent data remain. `getMyTasks` still selects Pending/InProgress assignments without filtering out nonexistent projects (`workflow.service.ts:844–871`), so users retain tasks that navigate to a deleted project. Laboratory records also become orphaned.
- Fix: Either reject deletion of a populated project with a clear conflict, or transactionally perform a complete logical cascade through experiments and workflow/project children. If archival is intended, model it explicitly rather than physically deleting just the root.
- Confidence: High. There is no FK from experiment/workflowInstance to project and no application cleanup in this path.

## S5 — [P1] Deleting an in-use workflow template breaks existing project workflows and task lists

**Status: bounded fix implemented.** `removeTemplate` now counts instances referencing the template and rejects deletion with BadRequestException when any exist, including Completed and Paused instances. Default-template protection is preserved. This guards already-existing references; concurrent creation versus deletion remains a check-then-act race and was intentionally not expanded into a workflow-creation locking redesign.

- Location: `C:/Users/lengjing/workspace/code/github/eln/apps/backend/src/workflow/workflow.service.ts:165` (lines 165–170).
- Trigger: Create a project workflow from a nondefault template, then delete that template. Only `isDefault` is checked; referenced workflow instances are not checked.
- Impact: Existing instances retain the deleted templateId. `getGraphMeta` calls `findTemplateById` at line 346, which throws NotFoundException. Consequently project workflow reads (`findByProject`, line 391) fail, and an affected user's entire task-list request can fail at line 860 even when they have other healthy projects. Steps cannot proceed through paths that first load the project workflow.
- Fix: Prevent deletion while referenced, or snapshot/version the template graph for each instance and allow template archival. With logical FKs, enforce the restriction transactionally to avoid races with instance creation.
- Confidence: High. The project/instance graph is intentionally derived from the live template, and no database FK prevents its removal.

### S5 verification

- Added `apps/backend/src/workflow/workflow-template.spec.ts`, exercising real service methods with in-memory repository I/O doubles and no database access.
- Before the service change: `pnpm --filter @eln/backend exec jest src/workflow/workflow-template.spec.ts --runInBand` failed as intended: **3 failed / 3 passed**. Deletion of Active, Completed and Paused referenced templates resolved instead of rejecting.
- After the guard: same command passed **6/6 tests**. Tests additionally verify unused custom templates can be deleted despite unrelated instances, unused default templates remain protected, and missing IDs return 404.
- Full backend suite: `pnpm --filter @eln/backend run test -- --runInBand` passed **11 suites / 48 tests**, exit 0.

## S6 — [P2] Migration CLI ignores the runtime's configured database username

- Location: `C:/Users/lengjing/workspace/code/github/eln/apps/backend/src/data-source.ts:30`.
- Trigger: Configure a nondefault `DB_USER` without `DATABASE_URL`, following `apps/backend/env/example.env:8` and runtime configuration. Runtime reads `DB_USER` in `apps/backend/src/config/configuration.ts:35`, whereas the migration/seed datasource reads `DB_USERNAME` and falls back to `eln`.
- Impact: The application and migration/seed commands authenticate as different database users. A deployment with a custom runtime user can run successfully while required schema migration commands fail authentication or use the wrong role privileges.
- Fix: Align the standalone datasource with the runtime `DB_USER` configuration (optionally retain the legacy name as an explicit compatibility fallback) and share configuration parsing.
- Confidence: High. Both source paths and the non-secret example file confirm the discrepancy.
- Status: Reported only, unchanged as requested.

## Scope notes

- Runtime migrations are deliberately required (`synchronize: false` in the standalone datasource); lack of physical foreign keys on most domain tables is an established strategy, not itself reported as a defect.
- The iron-dissolution stage migration and entity check use the same allowed values. The solution preparation grouping migration provides its experiment/group uniqueness constraint. No concrete schema-column drift is asserted from this review.
- Several other delete-and-reinsert or multi-repository paths lack a surrounding transaction, but they are not listed separately without a stronger distinct trigger/impact than the confirmed failures above.
- Parent review owns independent API testing, authorization/business behavior, and overall consolidation; deduplicate these findings against overlapping backend results.
