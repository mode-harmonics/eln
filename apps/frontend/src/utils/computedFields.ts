/**
 * Computed-field definitions per business table.
 *
 * Fields listed here are *derived from raw data* and should be
 * displayed as read‑only in edit UIs.  They are recalculated
 * automatically when raw data is re‑uploaded.
 */
export const COMPUTED_FIELDS: Record<string, string[]> = {
  process: [
    "fq",          // fq1 + fq2
    "mIn",         // m1 - m0
    "mLoss",       // m1 - m2
    "mHold",       // m4 - m0
    "fvg",         // (v1 - v0) / qdFirst
    "ku",          // fu1 - fu2
    "qcFirst",     // fq + gqc1
    "qdFirst",     // gqd1
    "ceFirst",     // qdFirst / qcFirst * 100
  ],
  calendar: [
    "qRetention",
    "qRecovery",
    "ddcrGrowth",
    "cdcrGrowth",
    "uGrowth",
    "rGrowth",
  ],
  swelling: [
    "vg",          // (v - v_0d) / qd1st
    "ee",          // (v - v_0d) / (v1 - v0)
  ],
  efficiency: [
    "ee",          // de / ce
  ],
  dcr: [
    "ddcr",        // |du1 - du0| / di
    "cdcr",        // |cu1 - cu0| / ci
    "dRcProduct",  // q0 * ddcr
    "cRcProduct",  // q0 * cdcr
  ],
  fastcharge: [
    "computedFastChargeTime",  // 10%-80% SOC
    "providedFastChargeTime",
    "stepSoc",
    "cumulativeSoc",
    "isFirstStep",
    "totalSteps",
  ],
  htcycle: [
    "capacityRetention",       // (cap / baseline) * 100
  ],
};

/** Returns true if `fieldName` is a computed field for the given API type. */
export function isComputedField(type: string, fieldName: string): boolean {
  const fields = COMPUTED_FIELDS[type];
  if (!fields) return false;
  return fields.includes(fieldName);
}
