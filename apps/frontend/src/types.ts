export type Role = {
  id: string;
  name: string;
  permissionList: string[];
};

export type User = {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  roleId: string;
  departmentId: string;
  isActive: boolean;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: "Active" | "Archived";
  createdBy: string;
  createdAt: string;
};

export type Experiment = {
  id: string;
  projectId: string;
  title: string;
  content: string;
  status: "Draft" | "In Review" | "Approved" | "Archived";
  metadata: {
    assayType?: string;
    notebookRef?: string;
    deviceUsed?: string;
    reagentLotId?: string;
  };
  aiAnalysisOutput?: string;
  versionNo: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  type: string;
  lotNumber: string;
  quantity: string;
  storageLocation: string;
  purity: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  lastUsedAt: string;
  createdAt: string;
};

// Battery Data Types
export type ProcessData = {
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
};

export type CalendarLife = {
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
};

export type StorageSwelling = {
  id: string;
  experimentId: string;
  cellName: string;
  qd1st: string | null;
  dayCount: number;
  v: string | null;
  vg: string | null;
  createdAt: string;
};

export type EnergyEfficiency = {
  id: string;
  experimentId: string;
  cellName: string;
  de: string | null;
  ce: string | null;
  notes: string | null;
  ee: string | null;
  eePct: string | null;
  createdAt: string;
};

export type DcrTest = {
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
};

export type FastChargeStep = {
  stepNo: number;
  rate: number | string | null;
  cutOffVoltage: number | string | null;
  current: number | string | null;
  stepCapacity: number | string | null;
  stepTime: number | string | null;
  stepSoc: number | null;
  cumulativeSoc: number | null;
};

export type FastCharge = {
  id: string;
  experimentId: string;
  cellName: string;
  c0: string | null;
  providedFastChargeTime: string | null;
  computedFastChargeTime: string | null;
  steps: FastChargeStep[] | null;
  createdAt: string;
};

export type HtCycle = {
  id: string;
  experimentId: string;
  cycle: number;
  caps: Record<string, number>;
  notes?: string | null;
  createdAt: string;
};
