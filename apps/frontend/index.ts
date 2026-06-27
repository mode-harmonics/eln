// Placeholder entry point for the reserved apps/frontend slot.
// No UI framework has been chosen/implemented yet — see README.md.
//
// This file exists so `tsc --noEmit` has something to compile and so the
// workspace dependency on @eln/shared is exercised (confirming the
// monorepo's path resolution and package linkage work end-to-end).

import { API_ROUTES, ExperimentStatus } from '@eln/shared';

console.log('ELN frontend — TODO (reserved slot, not yet implemented)');
console.log('Example shared import check:', API_ROUTES.auth.login, ExperimentStatus.DRAFT);