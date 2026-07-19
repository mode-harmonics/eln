/**
 * @eln/shared — Workflow & data-type configuration.
 * Single source of truth for all step → label / dataType / assayType mappings.
 * Both backend and frontend import from here.
 */

// ─── 7 business table types ─────────────────────────────────────────────
export const RECORD_TYPE_TO_API_TYPE: Record<string, string> = {
  ProcessData: 'process',
  CalendarLife: 'calendar',
  StorageSwelling: 'swelling',
  EnergyEfficiency: 'efficiency',
  DcrTest: 'dcr',
  FastCharge: 'fastcharge',
  HtCycle: 'htcycle',
};

export const RECORD_TYPE_TO_I18N_KEY: Record<string, string> = {
  ProcessData: 'process_data',
  CalendarLife: 'calendar_life',
  StorageSwelling: 'storage_swelling',
  EnergyEfficiency: 'energy_efficiency',
  DcrTest: 'dcr_test',
  FastCharge: 'fast_charge',
  HtCycle: 'ht_cycle',
};

// ─── Step → assayType mapping (for auto-creating experiments) ──────────
export const STEP_ASSAY_MAP: Record<string, string> = {
  drying_injection: 'ProcessData',
  formation: 'ProcessData',
  second_sealing: 'ProcessData',
  capacity_grading: 'ProcessData',
  calendar_life: 'CalendarLife',
  storage_swelling: 'StorageSwelling',
  energy_efficiency: 'EnergyEfficiency',
  dcr_test: 'DcrTest',
  fast_charge: 'FastCharge',
  ht_cycle: 'HtCycle',
};

// ─── Step → display label (i18n key) ──────────────────────────────────
export const STEP_LABEL_KEYS: Record<string, string> = {
  experiment_design: 'step_experiment_design',
  drying_injection: 'step_drying_injection',
  formation: 'step_formation',
  second_sealing: 'step_second_sealing',
  capacity_grading: 'step_capacity_grading',
  battery_selection: 'step_battery_selection',
  testing: 'step_testing',
  calendar_life: 'calendar_life',
  storage_swelling: 'storage_swelling',
  energy_efficiency: 'energy_efficiency',
  dcr_test: 'dcr_test',
  fast_charge: 'fast_charge',
  ht_cycle: 'ht_cycle',
};

/** Resolve a step name to its i18n key. */
export function getStepLabelKey(stepName: string): string {
  return STEP_LABEL_KEYS[stepName] || `step_${stepName}`;
}

// ─── Parallel child steps → English fallback labels ───────────────────
export const CHILD_STEP_LABELS: Record<string, string> = {
  calendar_life: 'Calendar Life',
  storage_swelling: 'Storage Swelling',
  energy_efficiency: 'Energy Efficiency',
  dcr_test: 'DCR Test',
  fast_charge: 'Fast Charge',
  ht_cycle: 'HT Cycle',
};

/** Resolve a child step name to an English fallback label. */
export function getChildStepLabel(name: string): string {
  return CHILD_STEP_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Step → dataType (for table rendering) ────────────────────────────
export const STEP_DATA_TYPE: Record<string, string> = {
  drying_injection: 'process',
  formation: 'process',
  second_sealing: 'process',
  capacity_grading: 'process',
  calendar_life: 'calendar',
  storage_swelling: 'swelling',
  energy_efficiency: 'efficiency',
  dcr_test: 'dcr',
  fast_charge: 'fastcharge',
  ht_cycle: 'htcycle',
};

// ─── Chinese label map (for step display without i18n) ─────────────────
export const STEP_NAME_MAP: Record<string, string> = {
  experiment_design: '实验设计',
  battery_selection: '电芯选取',
  drying_injection: '干燥/注液',
  formation: '化成',
  second_sealing: '二封',
  capacity_grading: '定容',
  calendar_life: '日历寿命',
  storage_swelling: '存储胀气',
  energy_efficiency: '能量效率',
  dcr_test: 'DCR测试',
  fast_charge: '快充测试',
  ht_cycle: '高温循环',
};
