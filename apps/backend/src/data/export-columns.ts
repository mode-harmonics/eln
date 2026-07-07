/**
 * Chinese column header mappings for Excel export.
 * Mirrors the frontend i18n column keys for consistency.
 */

/** Maps DB field name → Chinese display label for ProcessData */
export const PROCESS_COLUMNS: Record<string, string> = {
  cellId: '电芯编号',
  m0: 'm_d (注液前电芯重)',
  m1: 'm_a (预充后电芯重)',
  m2: 'm_w (二封后电芯重)',
  m3: 'rn_d (二封前称重)',
  m4: 'rn_a (二封后称重)',
  v0: 'V_s (二封前电压)',
  v1: 'V_e (二封后电压)',
  fu0: 'rU_s (化成前电压)',
  fr0: 'rR_s (化成前电阻)',
  fq1: 'rQ_s (化成充电容量1)',
  fq2: 'rQ_c (化成放电容量2)',
  fu1: 'rI_s (化成后电压1)',
  fr1: 'rR_e (化成后电阻1)',
  fu2: 'fI_a (化成后电压2)',
  fr2: 'fR_a (化成后电阻2)',
  gu0: 'GU_s (分容前电压)',
  gr0: 'GR_s (分容前电阻)',
  gqc1: 'GQC_s (分容充电容量1)',
  gqd1: 'GQD_s (分容放电容量1)',
  gqc2: 'GQC_e (分容充电容量2)',
  gu1: 'GU_e (分容后电压)',
  gr1: 'GR_e (分容后电阻)',
  // Computed
  mIn: 'm_v (注液量)',
  mLoss: 'rn_total (质量损失)',
  mHold: 'm_cap (保液量)',
  fq: 'rQ (化成充总容量)',
  qdFirst: 'QD_eff (首次放电容量)',
  fvg: 'rV_d (化成产气量)',
  ku: 'fU (老化压降)',
  qcFirst: 'QC_eff (首次充电容量)',
  ceFirst: 'CE_eff (首效)',
};

/** Maps DB field name → Chinese display label for CalendarLife */
export const CALENDAR_COLUMNS: Record<string, string> = {
  cellName: '电芯名称',
  dayCount: '天数',
  dq: '容量损失DQ',
  q: '容量Q',
  ddcr: '放电DCR',
  cdcr: '充电DCR',
  u: '电压U',
  r: '内阻R',
  // Computed
  qRetention: 'QRT (容量保持率)',
  qRecovery: 'QRC (容量恢复率)',
  ddcrGrowth: 'ΔDDCR (放电DCR增长率)',
  cdcrGrowth: 'ΔCDCR (充电DCR增长率)',
  uGrowth: 'ΔU (电压增长率)',
  rGrowth: 'ΔR (内阻增长率)',
};

/** Maps DB field name → Chinese display label for StorageSwelling */
export const SWELLING_COLUMNS: Record<string, string> = {
  cellName: '电芯名称',
  qd1st: '首次放电容量(Ah)',
  dayCount: '天数',
  v: '体积v(mL)',
  vg: 'vg (产气量)',
};

/** Maps DB field name → Chinese display label for EnergyEfficiency */
export const EFFICIENCY_COLUMNS: Record<string, string> = {
  cellName: '电芯名称',
  de: '放电能量',
  ce: '充电能量',
  ee: 'EE (能效比率)',
};

/** Maps DB field name → Chinese display label for DcrTest */
export const DCR_COLUMNS: Record<string, string> = {
  cellName: '电芯名称',
  q0: 'Q_0 (初始容量)',
  du0: 'DU_0 (放电压降)',
  du1: 'DU_1 (放电负载电压)',
  di: 'DI (放电电流)',
  cu0: 'CU_0 (充电压降)',
  cu1: 'CU_1 (充电负载电压)',
  ci: 'CI (充电电流)',
  c0: '容量c0 (Ah)',
  ddcr: 'DDCR (放电DCR)',
  cdcr: 'CDCR (充电DCR)',
};

/** Maps DB field name → Chinese display label for FastCharge */
export const FAST_CHARGE_COLUMNS: Record<string, string> = {
  cellName: '电芯名称',
  c0: '容量c0 (Ah)',
  providedTime: '提供时间(min)',
  computedFastChargeTime: '10%-80%SOC(min)',
  cutoffVoltage: '满电截止电压',
};

/** Maps DB field name → Chinese display label for HtCycle */
export const HT_CYCLE_COLUMNS: Record<string, string> = {
  cellName: '电芯名称',
  cycle: '循环圈数',
  capacity: '放电容量',
  retention: '容量保持率',
  ironPpm: '铁溶出量',
};

/** Maps DB field name → Chinese display label for RawStepData */
export const RAW_STEP_COLUMNS: Record<string, string> = {
  cellName: '电芯名称',
  cycleNo: '循环号',
  stepNo: '工步号',
  stepSeqNo: '工步序号',
  stepType: '工步类型',
  stepTime: '工步时间',
  capacity: '容量/能量',
  voltage: '电压',
  current: '电流',
  temperature: '温度',
};

/**
 * Returns the column header map for a given typeParam (e.g. "process", "calendar").
 */
export function getColumnHeaders(typeParam: string): Record<string, string> {
  switch (typeParam) {
    case 'process': return PROCESS_COLUMNS;
    case 'calendar': return CALENDAR_COLUMNS;
    case 'swelling': return SWELLING_COLUMNS;
    case 'efficiency': return EFFICIENCY_COLUMNS;
    case 'dcr': return DCR_COLUMNS;
    case 'fastcharge': return FAST_CHARGE_COLUMNS;
    case 'htcycle': return HT_CYCLE_COLUMNS;
    default: return {};
  }
}
