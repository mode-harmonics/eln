/**
 * Shared record type configuration — re-exported from @eln/shared.
 */

import { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY } from "@eln/shared";

export { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY };

/** All API type segments for iteration */
export const ALL_API_TYPES = Object.values(RECORD_TYPE_TO_API_TYPE);

/** All record type keys */
export const ALL_RECORD_TYPES = Object.keys(RECORD_TYPE_TO_API_TYPE);
