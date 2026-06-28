// ============================================================================
// DTOs for the 7 battery-science business tables (BACKEND_SPEC.md §二).
// These mirror the TypeORM entities but stay framework-agnostic so the
// future apps/frontend SPA can consume them without depending on TypeORM.
// ============================================================================

export interface ProcessDataDto {
  id: string;
  experimentId: string;
  cellId: string;
  m0: string | null;
  m1: string | null;
  m2: string | null;
  v0: string | null;
  v1: string | null;
  fu0: string | null;
  fr0: string | null;
  fq1: string | null;
  fq2: string | null;
  fu1: string | null;
  fr1: string | null;
  fu2: string | null;
  fr2: string | null;
  m3: string | null;
  m4: string | null;
  gu0: string | null;
  gr0: string | null;
  gqc1: string | null;
  gqd1: string | null;
  gqc2: string | null;
  gu1: string | null;
  gr1: string | null;
  mIn: string | null;
  mLoss: string | null;
  mHold: string | null;
  fq: string | null;
  qdFirst: string | null;
  fvg: string | null;
  ku: string | null;
  qcFirst: string | null;
  ceFirst: string | null;
  picked: boolean;
  createdAt: string;
}

export interface CalendarLifeDto {
  id: string;
  experimentId: string;
  cellName: string;
  isHorizontal: boolean;
  dayCount: number;
  q: string | null;
  dq: string | null;
  ddcr: string | null;
  cdcr: string | null;
  u: string | null;
  r: string | null;
  qRetention: string | null;
  qRecovery: string | null;
  ddcrGrowth: string | null;
  cdcrGrowth: string | null;
  uGrowth: string | null;
  rGrowth: string | null;
  createdAt: string;
}

export interface StorageSwellingDto {
  id: string;
  experimentId: string;
  cellName: string;
  qd1st: string | null;
  dayCount: number;
  v: string | null;
  vg: string | null;
  createdAt: string;
}

export interface EnergyEfficiencyDto {
  id: string;
  experimentId: string;
  cellName: string;
  de: string | null;
  ce: string | null;
  notes: string | null;
  ee: string | null;
  eePct: string | null;
  createdAt: string;
}

export interface DcrTestDto {
  id: string;
  experimentId: string;
  cellName: string;
  q0: string | null;
  du0: string | null;
  du1: string | null;
  di: string | null;
  cu0: string | null;
  cu1: string | null;
  ci: string | null;
  ddcr: string | null;
  cdcr: string | null;
  dRcProduct: string | null;
  cRcProduct: string | null;
  createdAt: string;
}

export interface FastChargeStepDto {
  stepNo: number;
  rate: number | string | null;
  cutOffVoltage: number | null;
  current: number | null;
  stepCapacity: number | null;
  stepTime: number | null;
  stepSoc: number | null;
  cumulativeSoc: number | null;
}

export interface FastChargeDto {
  id: string;
  experimentId: string;
  cellName: string;
  c0: string | null;
  providedFastChargeTime: string | null;
  computedFastChargeTime: string | null;
  steps: FastChargeStepDto[] | null;
  createdAt: string;
}

export interface HtCycleDto {
  id: string;
  experimentId: string;
  cycle: number;
  caps: Record<string, number>;
  notes: string | null;
  createdAt: string;
}