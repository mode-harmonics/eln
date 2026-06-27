// ============================================================================
// DTOs for the 7 battery-science business tables (BACKEND_SPEC.md §二).
// These mirror the TypeORM entities but stay framework-agnostic so the
// future apps/frontend SPA can consume them without depending on TypeORM.
// ============================================================================

export interface ProcessDataDto {
  id: string;
  experimentId: string;
  cellId: string;
  m0: number | null;
  m1: number | null;
  m2: number | null;
  v0: number | null;
  v1: number | null;
  fu0: number | null;
  fr0: number | null;
  fq1: number | null;
  fq2: number | null;
  fu1: number | null;
  fr1: number | null;
  fu2: number | null;
  fr2: number | null;
  m3: number | null;
  m4: number | null;
  gu0: number | null;
  gr0: number | null;
  gqc1: number | null;
  gqd1: number | null;
  gqc2: number | null;
  gu1: number | null;
  gr1: number | null;
  picked: boolean;
  createdAt: string;
}

export interface CalendarLifeDto {
  id: string;
  experimentId: string;
  cellName: string;
  isHorizontal: boolean;
  dayCount: number;
  q: number | null;
  dq: number | null;
  ddcr: number | null;
  cdcr: number | null;
  u: number | null;
  r: number | null;
  createdAt: string;
}

export interface StorageSwellingDto {
  id: string;
  experimentId: string;
  cellName: string;
  qd1st: number | null;
  dayCount: number;
  v: number | null;
  createdAt: string;
}

export interface EnergyEfficiencyDto {
  id: string;
  experimentId: string;
  cellName: string;
  de: number | null;
  ce: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DcrTestDto {
  id: string;
  experimentId: string;
  cellName: string;
  q0: number | null;
  du0: number | null;
  du1: number | null;
  di: number | null;
  cu0: number | null;
  cu1: number | null;
  ci: number | null;
  createdAt: string;
}

export interface FastChargeStepDto {
  stepNo: number;
  rate: number | null;
  cutOffVoltage: number | null;
  current: number | null;
  stepCapacity: number | null;
  stepTime: number | null;
}

export interface FastChargeDto {
  id: string;
  experimentId: string;
  cellName: string;
  c0: number | null;
  providedFastChargeTime: number | null;
  steps: FastChargeStepDto[];
  createdAt: string;
}

export interface HtCycleDto {
  id: string;
  experimentId: string;
  cycle: number;
  /** Keys are `${batteryId}` -> capacity and `${batteryId}_ret` -> retention %. */
  caps: Record<string, number>;
  createdAt: string;
}