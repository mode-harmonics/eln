# Review remediation

User approved the review recommendations on 2026-09-23. Preserve the existing schema strategy, decimal contracts, UI design and previous fixes.

1. Centralize project/experiment/step object authorization across all HTTP entry points, search and dashboard. Keep role permission checks. Only project owners manage workflow assignments.
2. Apply completed-step and experiment-state rules consistently to data mutations. Make related writes transactional.
3. Reject deletion of nonempty projects and experiments; allow empty draft cleanup. Serialize experiment lifecycle changes with audit history.
4. Validate pagination and UUIDs at HTTP boundaries; hide unexpected internal errors. Align database configuration and disable automatic demo seeding in production defaults.
5. Repair frontend partial failures, retry behavior, pending states and accessible controls without redesign.
6. Add targeted regressions, run type checks/builds, then rerun independent HTTP and database E2E tests in the disposable PostgreSQL container. Update the review with measured results and remaining limitations.

Work split: backend agent owns access policy/controllers/search/dashboard; persistence agent owns data/workflow/design/procurement services; frontend agent owns frontend; primary owns deletion/lifecycle/configuration/independent verification. No deployment or production data changes.
