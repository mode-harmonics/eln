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
