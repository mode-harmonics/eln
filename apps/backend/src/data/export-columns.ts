/**
 * Chinese column header mappings for Excel export.
 * Mirrors the frontend i18n column keys for consistency.
 */

/** Maps DB field name → Chinese display label for ProcessData */
// Order matches the frontend P_COLS exactly: 称重→化成→二封→定容→综合计算
export const PROCESS_COLUMNS: Record<string, string> = {
  cellId: '电池编号',
  // 注液工序
  m0: '电池初始质量',
  m1: '注液后质量',
  mIn: '注液量',
  m2: '预封后电池质量',
  mLoss: '失液量',
  // 化成前电池体积
  v0: '化成前电池体积',
  // 化成工序
  fu0: '初始电压',
  fr0: '初始内阻',
  fq1: '第一步充电容量',
  fq2: '第二步充电容量',
  fq: '化成充电容量',
  v1: '化成后电池体积',
  fvg: '化成产气量',
  fu1: '老化前电压',
  fr1: '老化前内阻',
  fu2: '老化后电压',
  fr2: '老化后内阻',
  ku: '老化电压降',
  // 二封
  m3: '二封前电池质量',
  m4: '二封后电池质量',
  mHold: '保液量',
  // 定容工序
  gu0: '定容前电压',
  gr0: '定容前内阻',
  gqc1: '第一步充电容量',
  gqd1: '第一步放电容量',
  gqc2: '第二步充电容量',
  gu1: '定容后电压',
  gr1: '定容后内阻',
  // 首圈数据
  qcFirst: '首次充电容量',
  qdFirst: '首次放电容量',
  ceFirst: '首圈效率',
};

/** Maps DB field name → Chinese display label for CalendarLife */
// Order matches frontend CAL_COLS
export const CALENDAR_COLUMNS: Record<string, string> = {
  cellName: '电池编号',
  dayCount: '天数',
  dq: '首次放电容量',
  q: '定容容量',
  qRetention: '容量保持率',
  qRecovery: '容量恢复率',
  ddcr: '放电DCR',
  ddcrGrowth: '放电DCR增长',
  cdcr: '充电DCR',
  cdcrGrowth: '充电DCR增长',
  u: '电压',
  uGrowth: '电压增长',
  r: '内阻',
  rGrowth: '内阻增长',
};

/** Maps DB field name → Chinese display label for StorageSwelling */
// Order matches frontend SWELL_COLS
export const SWELLING_COLUMNS: Record<string, string> = {
  cellName: '电池编号',
  qd1st: '初始定容',
  dayCount: '天数',
  v: '存储后电池体积',
  vg: '产气量',
};

/** Maps DB field name → Chinese display label for EnergyEfficiency */
// Order matches frontend EFF_COLS
export const EFFICIENCY_COLUMNS: Record<string, string> = {
  cellName: '电池编号',
  de: '放电能量',
  ce: '充电能量',
  ee: '能量效率',
};

/** Maps DB field name → Chinese display label for DcrTest */
// Order matches frontend DCR_COLS
export const DCR_COLUMNS: Record<string, string> = {
  cellName: '电池编号',
  q0: '定容容量',
  du0: '放电初始电压',
  du1: '放电结束电压',
  di: '放电电流',
  ddcr: '放电DCR',
  cu0: '充电初始电压',
  cu1: '充电结束电压',
  ci: '充电电流',
  cdcr: '充电DCR',
  dRcProduct: '放电R-C乘积',
  cRcProduct: '充电R-C乘积',
};

/** Maps DB field name → Chinese display label for FastCharge */
// Order matches frontend FC_COLS (cellName + c0 + providedFastChargeTime on the parent row)
export const FAST_CHARGE_COLUMNS: Record<string, string> = {
  cellName: '电池编号',
  c0: '容量 c0 (Ah)',
  providedFastChargeTime: '标称快充时间 (分钟)',
  stepNo: '工步号',
  cutOffVoltage: '全电截止电压',
  current: '电流',
  rate: '倍率',
  stepCapacity: '单步容量',
  stepSoc: '单步SOC',
  cumulativeSoc: '累计SOC',
  stepTime: '单步时间(min)',
  computedFastChargeTime: '10%-80%SOC(min)',
};

/** Maps DB field name → Chinese display label for HtCycle */
// Order matches frontend HT_COLS
export const HT_CYCLE_COLUMNS: Record<string, string> = {
  cellName: '电池编号',
  ironDissolution: '铁溶出量',
  cycle: '循环圈数',
  dischargeCapacity: '放电容量',
  capacityRetention: '容量保持率',
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
