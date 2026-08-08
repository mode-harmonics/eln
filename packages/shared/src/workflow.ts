/**
 * @eln/shared — Workflow & data-type configuration.
 * Single source of truth for all step → label / dataType / assayType mappings.
 * Both backend and frontend import from here.
 */

// ─── 7 business table types ─────────────────────────────────────────────
export const RECORD_TYPE_TO_API_TYPE: Record<string, string> = {
  ProcessData: 'process',
  SolutionPreparation: 'solution',
  CalendarLife: 'calendar',
  StorageSwelling: 'swelling',
  EnergyEfficiency: 'efficiency',
  DcrTest: 'dcr',
  FastCharge: 'fastcharge',
  HtCycle: 'htcycle',
};

export const RECORD_TYPE_TO_I18N_KEY: Record<string, string> = {
  ProcessData: 'process_data',
  SolutionPreparation: 'solution_preparation',
  CalendarLife: 'calendar_life',
  StorageSwelling: 'storage_swelling',
  EnergyEfficiency: 'energy_efficiency',
  DcrTest: 'dcr_test',
  FastCharge: 'fast_charge',
  HtCycle: 'ht_cycle',
};

// ─── Step → assayType mapping (for auto-creating experiments) ──────────
export const STEP_ASSAY_MAP: Record<string, string> = {
  solution_preparation: 'SolutionPreparation',
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

// ─── assayType → workflow step name(s) fed by summary imports ──────────
// ProcessData is the shared fabrication dataset, so it is mirrored into
// every fabrication step's experiment so the workflow view shows data for
// each of them (干燥/注液, 化成, 二封, 定容).
export const ASSAY_TO_STEP_NAMES: Record<string, string[]> = {
  ProcessData: ['drying_injection', 'formation', 'second_sealing', 'capacity_grading'],
  SolutionPreparation: ['solution_preparation'],
  CalendarLife: ['calendar_life'],
  StorageSwelling: ['storage_swelling'],
  EnergyEfficiency: ['energy_efficiency'],
  DcrTest: ['dcr_test'],
  FastCharge: ['fast_charge'],
  HtCycle: ['ht_cycle'],
};

// ─── Summary-workbook sheet-name keyword → assayType routing ───────────
// Used by the project-level 汇总数据 import to route each sheet to the
// experiment of the matching assay type.
export interface SummarySheetRoute {
  keyword: string;
  assayType: string;
  label: string;
}
export const SUMMARY_SHEET_ROUTES: SummarySheetRoute[] = [
  { keyword: '制程', assayType: 'ProcessData', label: '制程数据' },
  { keyword: '日历', assayType: 'CalendarLife', label: '日历寿命' },
  { keyword: '胀气', assayType: 'StorageSwelling', label: '存储胀气' },
  { keyword: 'dcr', assayType: 'DcrTest', label: 'DCR测试' },
  { keyword: '能效', assayType: 'EnergyEfficiency', label: '能量效率' },
  { keyword: '快充', assayType: 'FastCharge', label: '快充时间' },
  { keyword: '高温循环', assayType: 'HtCycle', label: '高温循环' },
];

// ─── Step → display label (i18n key) ──────────────────────────────────
export const STEP_LABEL_KEYS: Record<string, string> = {
  experiment_design: 'step_experiment_design',
  design: 'step_design',
  procurement: 'step_procurement',
  solution_preparation: 'step_solution_preparation',
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

// ─── Child steps → English fallback labels ─────────────────────────
export const CHILD_STEP_LABELS: Record<string, string> = {
  design: 'Experiment Design',
  procurement: 'Reagent Procurement',
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
  solution_preparation: 'solution',
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

import { BuiltInStep } from './enums';

// ─── Chinese label map (for step display without i18n) ─────────────────
export const STEP_NAME_MAP: Record<string, string> = {
  experiment_design: '实验设计',
  design: '实验设计',
  procurement: '试剂采购',
  battery_selection: '电池选取',
  solution_preparation: '配液',
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

/** Resolve a step's Chinese display label, with English fallback. */
export function getStepDisplayName(stepName: string): string {
  return STEP_NAME_MAP[stepName] || getChildStepLabel(stepName);
}

/** Check if a step corresponds to the Experiment Design module (design or procurement). */
export function isExperimentDesignStep(stepName: string, builtInStep?: string | null): boolean {
  const b = builtInStep || stepName;
  return b === BuiltInStep.ExperimentDesign || b === BuiltInStep.Design || b === BuiltInStep.Procurement
    || stepName === 'experiment_design' || stepName === 'design' || stepName === 'procurement';
}

/** Check if a step corresponds to Cell Selection. */
export function isBatterySelectionStep(stepName: string, builtInStep?: string | null): boolean {
  const b = builtInStep || stepName;
  return b === BuiltInStep.BatterySelection || stepName === 'battery_selection';
}

/** Check if a step corresponds to Testing group node. */
export function isTestingStep(stepName: string, builtInStep?: string | null): boolean {
  const b = builtInStep || stepName;
  return b === BuiltInStep.Testing || stepName === 'testing';
}

/** Resolve builtInStep from stepMeta or fallback to stepName (supports both argument orders). */
export function resolveBuiltInStep(a: any, b?: any): string {
  if (typeof a === 'string') {
    return b?.[a]?.builtInStep ?? a;
  }
  if (typeof b === 'string') {
    return a?.[b]?.builtInStep ?? b;
  }
  return '';
}

/** Steps whose builtInStep indicates they should NOT auto-create an experiment. */
export const BS_NO_AUTO_EXP: string[] = [
  BuiltInStep.ExperimentDesign, BuiltInStep.Design, BuiltInStep.Procurement, BuiltInStep.BatterySelection, BuiltInStep.Testing,
];

/** Steps whose builtInStep triggers special sidebar panels. */
export const BS_SPECIAL_PANEL: string[] = [
  BuiltInStep.ExperimentDesign, BuiltInStep.Design, BuiltInStep.Procurement, BuiltInStep.BatterySelection, BuiltInStep.Testing,
];

/** Check if a step triggers a special sidebar panel. */
export function isSpecialPanelStep(stepName: string, builtInStep?: string | null): boolean {
  const b = builtInStep || stepName;
  return BS_SPECIAL_PANEL.includes(b) || isExperimentDesignStep(stepName, builtInStep) || isBatterySelectionStep(stepName, builtInStep) || isTestingStep(stepName, builtInStep);
}

export interface ResolveStepRouteParams {
  stepName: string;
  projectId: string;
  experiments?: Array<{ id: string; workflowStepName?: string | null }>;
  builtInStep?: string | null;
}

/** Single source of truth for resolving a workflow step's frontend route URL. */
export function resolveStepRoute(params: ResolveStepRouteParams): string | null {
  const { stepName, projectId, experiments = [], builtInStep } = params;
  if (isExperimentDesignStep(stepName, builtInStep)) {
    return `/projects/${projectId}/design`;
  }
  if (isBatterySelectionStep(stepName, builtInStep)) {
    return `/projects/${projectId}/cell-picker`;
  }
  if (isTestingStep(stepName, builtInStep)) {
    return null;
  }
  const exp = experiments.find((e) => (e as any).workflowStepName === stepName);
  return exp ? `/projects/${projectId}/experiments/${exp.id}` : null;
}

// ─── Step Graph → Step Tree Parser ───────────────────────────────────
import type { WorkflowStepNodeDto } from './dto/workflow.dto';

export function parseGraphToStepTree(graph: {
  nodes?: Array<{ id: string; label: string; builtInStep?: string; parentId?: string }>;
  edges?: Array<{ from: string; to: string }>;
}): WorkflowStepNodeDto[] {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const outDegree = new Map<string, number>();
  const outTargets = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) { outDegree.set(n.id, 0); outTargets.set(n.id, []); inDegree.set(n.id, 0); }
  for (const e of edges) {
    outDegree.set(e.from, (outDegree.get(e.from) || 0) + 1);
    outTargets.get(e.from)!.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  }

  const childOf = new Map<string, string[]>();
  const childSet = new Set<string>();

  for (const n of nodes) {
    if (n.parentId) {
      childSet.add(n.id);
      const list = childOf.get(n.parentId) || [];
      list.push(n.id);
      childOf.set(n.parentId, list);
    }
  }

  for (const n of nodes) {
    const targets = outTargets.get(n.id) || [];
    if (targets.length > 1) {
      const list = childOf.get(n.id) || [];
      for (const t of targets) {
        if (!childSet.has(t)) {
          childSet.add(t);
          if (!list.includes(t)) list.push(t);
        }
      }
      childOf.set(n.id, list);
    }
  }

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  const remaining = new Map(inDegree);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const t of outTargets.get(cur) || []) {
      const d = (remaining.get(t) || 1) - 1;
      remaining.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  for (const n of nodes) {
    if (!order.includes(n.id)) order.push(n.id);
  }

  const topNodes = order.filter((id) => !childSet.has(id));

  return topNodes.map((id, i) => {
    const n = nodeMap.get(id)!;
    const childIds = childOf.get(id) || [];
    const isParallel = (outDegree.get(id) || 0) > 1;

    const children: WorkflowStepNodeDto[] | undefined = childIds.length > 0
      ? childIds.map((cId, ci) => {
          const cn = nodeMap.get(cId)!;
          return {
            id: cn.id,
            name: cn.id,
            label: cn.label,
            builtInStep: cn.builtInStep ?? null,
            dataType: STEP_DATA_TYPE[cn.id] ?? null,
            type: 'task',
            sortOrder: ci,
          };
        })
      : undefined;

    return {
      id: n.id,
      name: n.id,
      label: n.label,
      builtInStep: n.builtInStep ?? null,
      dataType: STEP_DATA_TYPE[n.id] ?? null,
      type: childIds.length > 0 ? (isParallel ? 'parallel' : 'serial') : 'task',
      children,
      sortOrder: i,
    };
  });
}

export function normalizeTemplateSteps(steps: any): WorkflowStepNodeDto[] {
  if (Array.isArray(steps)) return steps;
  if (steps && Array.isArray(steps.steps)) return steps.steps;
  if (steps && Array.isArray(steps.nodes)) return parseGraphToStepTree(steps);
  return [];
}

// ─── Graph → per-step hierarchy meta (derived, never persisted) ────────
/**
 * Derive grouping/hierarchy info from a workflow template graph.
 *
 * This is the single source of truth for "is this step a group?" and
 * "which group does this step belong to?" — both are derived from the
 * template graph (nodes + edges) at read time instead of being stored
 * on each workflow step assignment.
 *
 * Rules (mirror parseGraphToStepTree / WorkflowConfig layout):
 * 1. A node with an explicit `parentId` is a child of that node.
 * 2. A node with out-degree > 1 (fan-out) is a group; its direct targets
 *    that aren't already claimed by a parentId become its children.
 */
export interface WorkflowGraphMeta {
  /** stepId → true if it is a group (has children) */
  isGroup: Record<string, boolean>;
  /**
   * stepId → group execution type.
   * - 'serial': children MUST run in order (e.g. experiment_design's
   *   design → procurement, expressed by edges between the children).
   * - 'parallel': children run concurrently (e.g. testing's 6 test types,
   *   a fan-out with out-degree > 1).
   */
  groupType: Record<string, 'serial' | 'parallel'>;
  /** childStepId → parentGroupStepId */
  parentOf: Record<string, string>;
  /** parentGroupStepId → child step ids (in topological/execution order) */
  childrenOf: Record<string, string[]>;
}

export function deriveWorkflowGraphMeta(graph: {
  nodes?: Array<{ id: string; label?: string; builtInStep?: string; parentId?: string }>;
  edges?: Array<{ from: string; to: string }>;
}): WorkflowGraphMeta {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  const outTargets = new Map<string, string[]>();
  for (const n of nodes) outTargets.set(n.id, []);
  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    const list = outTargets.get(e.from) || [];
    if (!list.includes(e.to)) list.push(e.to);
    outTargets.set(e.from, list);
  }

  const parentOf: Record<string, string> = {};
  const childrenOf: Record<string, string[]> = {};
  const childSet = new Set<string>();
  const addChild = (parent: string, child: string) => {
    if (parent === child || !nodeIds.has(parent)) return;
    if (childSet.has(child)) return; // already claimed (parentId wins)
    childSet.add(child);
    parentOf[child] = parent;
    (childrenOf[parent] ||= []).push(child);
  };

  // 1. explicit parentId wins
  for (const n of nodes) {
    if (n.parentId) addChild(n.parentId, n.id);
  }
  // 2. fan-out (out-degree > 1) group children
  for (const n of nodes) {
    const targets = outTargets.get(n.id) || [];
    if (targets.length > 1) {
      for (const t of targets) addChild(n.id, t);
    }
  }

  // Order each group's children by global topological order so serial
  // groups (design → procurement) have a deterministic execution sequence.
  const topoOrder = topoSortIds(nodes, edges);
  const rank = new Map(topoOrder.map((id, i) => [id, i]));
  for (const parent of Object.keys(childrenOf)) {
    childrenOf[parent].sort(
      (a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0),
    );
  }

  const isGroup: Record<string, boolean> = {};
  const groupType: Record<string, 'serial' | 'parallel'> = {};
  for (const n of nodes) {
    const hasChildren = !!childrenOf[n.id]?.length;
    isGroup[n.id] = hasChildren;
    if (hasChildren) {
      // Fan-out (out-degree > 1) = true parallelism; otherwise the
      // children are ordered by their edges (serial group).
      groupType[n.id] = (outTargets.get(n.id) || []).length > 1 ? 'parallel' : 'serial';
    }
  }

  return { isGroup, groupType, parentOf, childrenOf };
}

/** Minimal topological sort over a graph; used to order serial group children. */
function topoSortIds(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string }>,
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    adjacency.get(e.from)!.push(e.to);
  }
  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  const result: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    result.push(cur);
    for (const t of adjacency.get(cur) || []) {
      const d = (inDegree.get(t) || 1) - 1;
      inDegree.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  for (const id of nodeIds) if (!result.includes(id)) result.push(id);
  return result;
}
