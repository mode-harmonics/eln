/**
 * Shared record type configuration.
 * Single source of truth for mapping between record type keys, API route segments, and i18n display names.
 */

/** Maps experiment metadata.recordType to the API route path segment used by /api/v1/data/:type/:expId */
export const RECORD_TYPE_TO_API_TYPE: Record<string, string> = {
  ProcessData: "process",
  CalendarLife: "calendar",
  StorageSwelling: "swelling",
  EnergyEfficiency: "efficiency",
  DcrTest: "dcr",
  FastCharge: "fastcharge",
  HtCycle: "htcycle",
};

/** Maps record type to i18n key for display name (e.g. t("process_data")) */
export const RECORD_TYPE_TO_I18N_KEY: Record<string, string> = {
  ProcessData: "process_data",
  CalendarLife: "calendar_life",
  StorageSwelling: "storage_swelling",
  EnergyEfficiency: "energy_efficiency",
  DcrTest: "dcr_test",
  FastCharge: "fast_charge",
  HtCycle: "ht_cycle",
};

/** All API type segments for iteration */
export const ALL_API_TYPES = Object.values(RECORD_TYPE_TO_API_TYPE);

/** All record type keys */
export const ALL_RECORD_TYPES = Object.keys(RECORD_TYPE_TO_API_TYPE);
