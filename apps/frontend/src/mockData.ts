import { Experiment, InventoryItem, Project, User, ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle } from "./types";

export const MOCK_USERS: User[] = [
  {
    id: "u1",
    email: "pi@eln.local",
    fullName: "Dr. Alan Turing",
    roleId: "r1", // Owner
    departmentId: "d1",
    isActive: true,
  },
  {
    id: "u2",
    email: "editor@eln.local",
    fullName: "Marie Curie",
    roleId: "r2", // Editor
    departmentId: "d1",
    isActive: true,
  },
] as any;

export const MOCK_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Solid State Battery V2",
    description: "Development of high-energy density solid state batteries.",
    status: "Active",
    createdBy: "u1",
    createdAt: "2024-01-15T08:00:00Z",
  },
  {
    id: "p2",
    name: "Fast Charging Li-ion",
    description: "Investigating new electrolyte additives for 4C fast charging.",
    status: "Active",
    createdBy: "u1",
    createdAt: "2024-02-10T09:30:00Z",
  },
] as any;

export const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: "e1",
    projectId: "p1",
    title: "Initial Synthesis of SSE-001 (Process Data)",
    content: "# Objective\nSynthesize solid state electrolyte batch 001.",
    status: "Approved",
    metadata: {
      assayType: "ProcessData",
    },
    versionNo: 2,
    createdBy: "u2",
    createdAt: "2024-01-16T10:00:00Z",
    updatedAt: "2024-01-17T11:00:00Z",
  },
  {
    id: "e2",
    projectId: "p1",
    title: "Calendar Life Test - SSE-001",
    content: "# Objective\nEvaluate 60C calendar life of SSE-001 full cells.",
    status: "In Review",
    metadata: {
      assayType: "CalendarLife",
    },
    aiAnalysisOutput: "## AI Insights\nThe capacity retention looks promising.",
    versionNo: 1,
    createdBy: "u2",
    createdAt: "2024-02-01T14:00:00Z",
    updatedAt: "2024-02-15T15:00:00Z",
  },
  {
    id: "e3",
    projectId: "p1",
    title: "Storage Swelling Test - SSE-001",
    content: "# Objective\nEvaluate cell swelling during high temperature storage.",
    status: "Approved",
    metadata: {
      assayType: "StorageSwelling",
    },
    versionNo: 1,
    createdBy: "u2",
    createdAt: "2024-02-10T10:00:00Z",
    updatedAt: "2024-02-10T10:00:00Z",
  },
  {
    id: "e4",
    projectId: "p1",
    title: "Energy Efficiency Analysis",
    content: "# Objective\nMeasure charge and discharge energy efficiency.",
    status: "Approved",
    metadata: {
      assayType: "EnergyEfficiency",
    },
    versionNo: 1,
    createdBy: "u1",
    createdAt: "2024-02-12T09:00:00Z",
    updatedAt: "2024-02-12T09:00:00Z",
  },
  {
    id: "e5",
    projectId: "p1",
    title: "DCR Test Results",
    content: "# Objective\nMeasure direct current internal resistance (DCR) at different SOC levels.",
    status: "In Review",
    metadata: {
      assayType: "DcrTest",
    },
    versionNo: 1,
    createdBy: "u1",
    createdAt: "2024-02-15T11:30:00Z",
    updatedAt: "2024-02-16T08:00:00Z",
  },
  {
    id: "e6",
    projectId: "p1",
    title: "Fast Charge Protocol Validation",
    content: "# Objective\nValidate 4C fast charge profile for SSE-001.",
    status: "Approved",
    metadata: {
      assayType: "FastCharge",
    },
    versionNo: 3,
    createdBy: "u2",
    createdAt: "2024-02-20T14:00:00Z",
    updatedAt: "2024-02-22T10:00:00Z",
  },
  {
    id: "e7",
    projectId: "p1",
    title: "High Temperature Cycling Test",
    content: "# Objective\nEvaluate cycle life performance at 45C.",
    status: "In Review",
    metadata: {
      assayType: "HtCycle",
    },
    versionNo: 1,
    createdBy: "u1",
    createdAt: "2024-02-25T09:00:00Z",
    updatedAt: "2024-02-25T09:00:00Z",
  },
] as any;

export const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: "i1",
    name: "Lithium Iron Phosphate (LFP)",
    type: "Active Material",
    lotNumber: "LFP-2401A",
    quantity: "5 kg",
    storageLocation: "Shelf A-1",
    purity: "99.9%",
    status: "In Stock",
    lastUsedAt: "2024-02-10T00:00:00Z",
    createdAt: "2023-12-01T00:00:00Z",
  },
  {
    id: "i2",
    name: "N-Methyl-2-pyrrolidone (NMP)",
    type: "Solvent",
    lotNumber: "NMP-2311B",
    quantity: "0.5 L",
    storageLocation: "Flammable Cabinet 2",
    purity: "99.5%",
    status: "Low Stock",
    lastUsedAt: "2024-02-14T00:00:00Z",
    createdAt: "2023-11-15T00:00:00Z",
  },
] as any;

export const MOCK_PROCESS_DATA: ProcessData[] = [
  { id: "pd-0", experimentId: "e2", cellId: "A-1", fq: "3.04222738082724", gqc1: "0.05", gqd1: "2.940678392612321", createdAt: "2024-02-01T14:00:00Z" },
  { id: "pd-1", experimentId: "e2", cellId: "A-2", fq: "2.9986301656941343", gqc1: "0.05", gqd1: "2.9947918641829347", createdAt: "2024-02-01T14:00:00Z" },
  { id: "pd-2", experimentId: "e2", cellId: "A-3", fq: "2.9988730305706914", gqc1: "0.05", gqd1: "2.9852472941180705", createdAt: "2024-02-01T14:00:00Z" },
  { id: "pd-3", experimentId: "e2", cellId: "B-1", fq: "3.220384133748376", gqc1: "0.05", gqd1: "3.1042720245653705", createdAt: "2024-02-01T14:00:00Z" },
  { id: "pd-4", experimentId: "e2", cellId: "B-2", fq: "3.197196111365959", gqc1: "0.05", gqd1: "3.1352337975082576", createdAt: "2024-02-01T14:00:00Z" },
  { id: "pd-5", experimentId: "e2", cellId: "B-3", fq: "3.15517997963515", gqc1: "0.05", gqd1: "3.1445347922596594", createdAt: "2024-02-01T14:00:00Z" }
] as any;

export const MOCK_CALENDAR_LIFE: CalendarLife[] = [
  { id: "cl-0d-0", experimentId: "e2", cellName: "A-1", dayCount: 0, q: "2.95", dq: "2.95", ddcr: "15", cdcr: "14.5", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-42d-0", experimentId: "e2", cellName: "A-1", dayCount: 42, q: "2.85", dq: "2.8", ddcr: "18", cdcr: "17.5", qRetention: "94.91525423728812", qRecovery: "96.61016949152543", ddcrGrowth: "19.999999999999996", cdcrGrowth: "20.68965517241379", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-0d-1", experimentId: "e2", cellName: "A-2", dayCount: 0, q: "2.95", dq: "2.95", ddcr: "15", cdcr: "14.5", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-42d-1", experimentId: "e2", cellName: "A-2", dayCount: 42, q: "2.85", dq: "2.8", ddcr: "18", cdcr: "17.5", qRetention: "94.91525423728812", qRecovery: "96.61016949152543", ddcrGrowth: "19.999999999999996", cdcrGrowth: "20.68965517241379", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-0d-2", experimentId: "e2", cellName: "A-3", dayCount: 0, q: "2.95", dq: "2.95", ddcr: "15", cdcr: "14.5", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-42d-2", experimentId: "e2", cellName: "A-3", dayCount: 42, q: "2.85", dq: "2.8", ddcr: "18", cdcr: "17.5", qRetention: "94.91525423728812", qRecovery: "96.61016949152543", ddcrGrowth: "19.999999999999996", cdcrGrowth: "20.68965517241379", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-0d-3", experimentId: "e2", cellName: "B-1", dayCount: 0, q: "3.15", dq: "3.15", ddcr: "15", cdcr: "14.5", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-42d-3", experimentId: "e2", cellName: "B-1", dayCount: 42, q: "3.08", dq: "3.05", ddcr: "16.5", cdcr: "16", qRetention: "96.82539682539682", qRecovery: "97.77777777777779", ddcrGrowth: "10.000000000000009", cdcrGrowth: "10.344827586206895", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-0d-4", experimentId: "e2", cellName: "B-2", dayCount: 0, q: "3.15", dq: "3.15", ddcr: "15", cdcr: "14.5", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-42d-4", experimentId: "e2", cellName: "B-2", dayCount: 42, q: "3.08", dq: "3.05", ddcr: "16.5", cdcr: "16", qRetention: "96.82539682539682", qRecovery: "97.77777777777779", ddcrGrowth: "10.000000000000009", cdcrGrowth: "10.344827586206895", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-0d-5", experimentId: "e2", cellName: "B-3", dayCount: 0, q: "3.15", dq: "3.15", ddcr: "15", cdcr: "14.5", createdAt: "2024-02-01T14:00:00Z" },
  { id: "cl-42d-5", experimentId: "e2", cellName: "B-3", dayCount: 42, q: "3.08", dq: "3.05", ddcr: "16.5", cdcr: "16", qRetention: "96.82539682539682", qRecovery: "97.77777777777779", ddcrGrowth: "10.000000000000009", cdcrGrowth: "10.344827586206895", createdAt: "2024-02-01T14:00:00Z" }
] as any;

export const MOCK_STORAGE_SWELLING: StorageSwelling[] = [
  { id: "ss-0d-0", experimentId: "e2", cellName: "A-1", qd1st: "2.95", dayCount: 0, v: "15", vg: "0", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-42d-0", experimentId: "e2", cellName: "A-1", qd1st: "2.95", dayCount: 42, v: "15.8", vg: "0.2711864406779663", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-0d-1", experimentId: "e2", cellName: "A-2", qd1st: "2.95", dayCount: 0, v: "15", vg: "0", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-42d-1", experimentId: "e2", cellName: "A-2", qd1st: "2.95", dayCount: 42, v: "15.8", vg: "0.2711864406779663", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-0d-2", experimentId: "e2", cellName: "A-3", qd1st: "2.95", dayCount: 0, v: "15", vg: "0", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-42d-2", experimentId: "e2", cellName: "A-3", qd1st: "2.95", dayCount: 42, v: "15.8", vg: "0.2711864406779663", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-0d-3", experimentId: "e2", cellName: "B-1", qd1st: "3.15", dayCount: 0, v: "15", vg: "0", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-42d-3", experimentId: "e2", cellName: "B-1", qd1st: "3.15", dayCount: 42, v: "15.2", vg: "0.06349206349206327", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-0d-4", experimentId: "e2", cellName: "B-2", qd1st: "3.15", dayCount: 0, v: "15", vg: "0", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-42d-4", experimentId: "e2", cellName: "B-2", qd1st: "3.15", dayCount: 42, v: "15.2", vg: "0.06349206349206327", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-0d-5", experimentId: "e2", cellName: "B-3", qd1st: "3.15", dayCount: 0, v: "15", vg: "0", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ss-42d-5", experimentId: "e2", cellName: "B-3", qd1st: "3.15", dayCount: 42, v: "15.2", vg: "0.06349206349206327", createdAt: "2024-02-01T14:00:00Z" }
] as any;

export const MOCK_ENERGY_EFFICIENCY: EnergyEfficiency[] = [
  { id: "ee-0", experimentId: "e2", cellName: "A-1", de: "40", ce: "42", eePct: "95.23809523809523", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ee-1", experimentId: "e2", cellName: "A-2", de: "40", ce: "42", eePct: "95.23809523809523", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ee-2", experimentId: "e2", cellName: "A-3", de: "40", ce: "42", eePct: "95.23809523809523", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ee-3", experimentId: "e2", cellName: "B-1", de: "41.5", ce: "42", eePct: "98.80952380952381", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ee-4", experimentId: "e2", cellName: "B-2", de: "41.5", ce: "42", eePct: "98.80952380952381", createdAt: "2024-02-01T14:00:00Z" },
  { id: "ee-5", experimentId: "e2", cellName: "B-3", de: "41.5", ce: "42", eePct: "98.80952380952381", createdAt: "2024-02-01T14:00:00Z" }
] as any;

export const MOCK_DCR_TEST: DcrTest[] = [
  { id: "dt-0", experimentId: "e2", cellName: "A-1", ddcr: "0.015", cdcr: "0.014", createdAt: "2024-02-01T14:00:00Z" },
  { id: "dt-1", experimentId: "e2", cellName: "A-2", ddcr: "0.015", cdcr: "0.014", createdAt: "2024-02-01T14:00:00Z" },
  { id: "dt-2", experimentId: "e2", cellName: "A-3", ddcr: "0.015", cdcr: "0.014", createdAt: "2024-02-01T14:00:00Z" },
  { id: "dt-3", experimentId: "e2", cellName: "B-1", ddcr: "0.012", cdcr: "0.011", createdAt: "2024-02-01T14:00:00Z" },
  { id: "dt-4", experimentId: "e2", cellName: "B-2", ddcr: "0.012", cdcr: "0.011", createdAt: "2024-02-01T14:00:00Z" },
  { id: "dt-5", experimentId: "e2", cellName: "B-3", ddcr: "0.012", cdcr: "0.011", createdAt: "2024-02-01T14:00:00Z" }
] as any;

export const MOCK_FAST_CHARGE: FastCharge[] = [
  { id: "fc-0", experimentId: "e2", cellName: "A-1", computedFastChargeTime: "27.672704020265833", createdAt: "2024-02-01T14:00:00Z" },
  { id: "fc-1", experimentId: "e2", cellName: "A-2", computedFastChargeTime: "27.689206055532672", createdAt: "2024-02-01T14:00:00Z" },
  { id: "fc-2", experimentId: "e2", cellName: "A-3", computedFastChargeTime: "28.1043303641144", createdAt: "2024-02-01T14:00:00Z" },
  { id: "fc-3", experimentId: "e2", cellName: "B-1", computedFastChargeTime: "25.85798090020828", createdAt: "2024-02-01T14:00:00Z" },
  { id: "fc-4", experimentId: "e2", cellName: "B-2", computedFastChargeTime: "25.468075420129345", createdAt: "2024-02-01T14:00:00Z" },
  { id: "fc-5", experimentId: "e2", cellName: "B-3", computedFastChargeTime: "25.867978864474725", createdAt: "2024-02-01T14:00:00Z" }
] as any;

export const MOCK_HT_CYCLE: HtCycle[] = [
  { id: "hc-0", experimentId: "e2", cycle: 100, cellName: "A-1", ironDissolution: "29.000000", dischargeCapacity: "3.000000", capacityRetention: "92.173365", createdAt: "2024-02-01T14:00:00Z" },
  { id: "hc-1", experimentId: "e2", cycle: 100, cellName: "A-2", ironDissolution: "28.000000", dischargeCapacity: "3.000000", capacityRetention: "92.697098", createdAt: "2024-02-01T14:00:00Z" },
  { id: "hc-2", experimentId: "e2", cycle: 100, cellName: "A-3", ironDissolution: "28.000000", dischargeCapacity: "3.000000", capacityRetention: "92.241250", createdAt: "2024-02-01T14:00:00Z" },
  { id: "hc-3", experimentId: "e2", cycle: 100, cellName: "B-1", ironDissolution: "17.000000", dischargeCapacity: "3.000000", capacityRetention: "96.202412", createdAt: "2024-02-01T14:00:00Z" },
  { id: "hc-4", experimentId: "e2", cycle: 100, cellName: "B-2", ironDissolution: "19.000000", dischargeCapacity: "3.000000", capacityRetention: "96.388288", createdAt: "2024-02-01T14:00:00Z" },
  { id: "hc-5", experimentId: "e2", cycle: 100, cellName: "B-3", ironDissolution: "17.000000", dischargeCapacity: "3.000000", capacityRetention: "95.986555", createdAt: "2024-02-01T14:00:00Z" }
] as any;
