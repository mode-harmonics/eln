/**
 * Battery picker — util for picking consistent cell groups.
 *
 * Pure functions, no NestJS / TypeORM dependencies.
 * Ported from battery_selector.py.
 *
 * Usage:
 *   import { pickBatteries } from '../battery-selector/pick-batteries';
 *   const result = pickBatteries({ records: [...cells] });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatteryRecord {
  id: string;
  QD1st: number;
  GR1: number;
  FVG: number;
  KU: number;
  _sampleKey: string;
  _originalOrder: number;
  _removedReason: string;
  _capacityZScore?: number;
}

export interface GroupRule {
  name: string;
  size: number;
}

export interface CandidateScore {
  score: number;
  maxRange: number;
  rangeVariance: number;
  originalOrderSum: number;
}

export interface RemovedRecord {
  id: string;
  reason: string;
  zScore: number;
  metrics: Record<string, number>;
}

export interface RemainingRecord {
  id: string;
  metrics: Record<string, number>;
}

export interface AssignmentRecord {
  group: string;
  sampleId: string;
  score: number;
  maxRange: number;
  rangeVariance: number;
  QD1st: number;
  GR1: number;
  FVG: number;
  KU: number;
  QD1stNorm: number;
  GR1Norm: number;
  FVGNorm: number;
  KUNorm: number;
}

export interface GroupSummary {
  group: string;
  sampleIds: string[];
  score: number;
  maxRange: number;
  rangeVariance: number;
}

export interface PickResult {
  assignments: AssignmentRecord[];
  groups: GroupSummary[];
  removed: RemovedRecord[];
  remaining: RemainingRecord[];
  warnings: string[];
}

const METRICS = ['QD1st', 'GR1', 'FVG', 'KU'] as const;

const DEFAULT_GROUPS: GroupRule[] = [
  { name: '高温循环', size: 5 },
  { name: '4C DCR & 能效', size: 3 },
  { name: '日历寿命', size: 3 },
  { name: '60℃存储胀气', size: 3 },
  { name: '快充时间', size: 3 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mean(v: number[]): number {
  if (v.length === 0) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function populationVariance(v: number[]): number {
  if (v.length === 0) return 0;
  const m = mean(v);
  return v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length;
}

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length;
  if (k < 0 || k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  yield idx.map((i) => arr[i]);
  while (true) {
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    yield idx.map((i) => arr[i]);
  }
}

function compareScores(a: CandidateScore, b: CandidateScore): number {
  const r = (x: number) => Math.round(x * 1e12) / 1e12;
  if (r(a.score) !== r(b.score)) return r(a.score) - r(b.score);
  if (r(a.maxRange) !== r(b.maxRange)) return r(a.maxRange) - r(b.maxRange);
  if (r(a.rangeVariance) !== r(b.rangeVariance)) return r(a.rangeVariance) - r(b.rangeVariance);
  return a.originalOrderSum - b.originalOrderSum;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

function removeOutliers(records: BatteryRecord[], zThreshold: number) {
  if (records.length === 0) return { kept: [] as BatteryRecord[], removed: [] as BatteryRecord[] };

  const values = records.map((r) => r.QD1st);
  const avg = mean(values);
  const std = Math.sqrt(populationVariance(values));

  const kept: BatteryRecord[] = [];
  const removed: BatteryRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = { ...records[i] };
    row._capacityZScore = std === 0 ? 0 : (values[i] - avg) / std;
    if (Math.abs(row._capacityZScore) >= zThreshold) {
      row._removedReason = `QD1st abs(z) >= ${zThreshold}`;
      removed.push(row);
    } else {
      kept.push(row);
    }
  }
  return { kept, removed };
}

function normalize(records: BatteryRecord[]): Record<string, Record<string, number>> {
  const bounds: Record<string, { min: number; max: number }> = {};
  for (const col of METRICS) {
    const vals = records.map((r) => (r as unknown as Record<string, number>)[col]);
    bounds[col] = { min: Math.min(...vals), max: Math.max(...vals) };
  }

  const norm: Record<string, Record<string, number>> = {};
  for (const row of records) {
    norm[row._sampleKey] = {};
    for (const col of METRICS) {
      const { min, max } = bounds[col];
      norm[row._sampleKey][col] = max === min ? 0 : ((row as unknown as Record<string, number>)[col] - min) / (max - min);
    }
  }
  return norm;
}

function scoreSubset(
  keys: string[],
  norm: Record<string, Record<string, number>>,
  orderByKey: Record<string, number>,
): CandidateScore {
  const ranges = METRICS.map((col) => {
    const vals = keys.map((k) => norm[k][col]);
    return Math.max(...vals) - Math.min(...vals);
  });

  const score = ranges.reduce((a, b) => a + b, 0);
  const maxRange = Math.max(...ranges);
  const avgRange = score / ranges.length;
  const rangeVariance = ranges.reduce((s, r) => s + (r - avgRange) ** 2, 0) / ranges.length;
  const originalOrderSum = keys.reduce((s, k) => s + (orderByKey[k] ?? 0), 0);
  return { score, maxRange, rangeVariance, originalOrderSum };
}

function pickBest(
  available: string[],
  norm: Record<string, Record<string, number>>,
  orderByKey: Record<string, number>,
  size: number,
) {
  let bestKeys: string[] | null = null;
  let bestScore: CandidateScore | null = null;

  for (const subset of combinations(available, size)) {
    const s = scoreSubset(subset, norm, orderByKey);
    if (!bestScore || compareScores(s, bestScore) < 0) {
      bestKeys = subset;
      bestScore = s;
    }
  }
  return { selectedKeys: bestKeys!, bestScore: bestScore! };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PickBatteriesOptions {
  records: { id: string; QD1st: number; GR1: number; FVG: number; KU: number }[];
  groups?: GroupRule[];
  skipOutlierRemoval?: boolean;
  zThreshold?: number;
  minRequiredCount?: number;
}

export function pickBatteries(options: PickBatteriesOptions): PickResult {
  const {
    records: raw,
    groups = DEFAULT_GROUPS,
    skipOutlierRemoval = false,
    zThreshold = 2.0,
    minRequiredCount,
  } = options;

  const required = groups.reduce((s, g) => s + g.size, 0);

  // Prepare
  const prepared: BatteryRecord[] = raw.map((r, i) => ({
    id: r.id,
    QD1st: r.QD1st,
    GR1: r.GR1,
    FVG: r.FVG,
    KU: r.KU,
    _sampleKey: `row-${i}`,
    _originalOrder: i,
    _removedReason: '',
  }));

  // Step 1: outlier removal
  const { kept, removed: removedRecs } = skipOutlierRemoval
    ? { kept: [...prepared], removed: [] as BatteryRecord[] }
    : removeOutliers(prepared, zThreshold);

  const warnings: string[] = [];
  if (kept.length < (minRequiredCount ?? required)) {
    warnings.push(`Outlier removal left ${kept.length} samples — fewer than required ${minRequiredCount ?? required}. Manual review recommended.`);
  }
  if (kept.length < required) {
    throw new Error(`Need ${required} samples, but only ${kept.length} remain after filtering.`);
  }

  // Step 2: global normalization
  const norm = normalize(kept);
  const recordByKey: Record<string, BatteryRecord> = {};
  const orderByKey: Record<string, number> = {};
  for (const r of kept) {
    recordByKey[r._sampleKey] = r;
    orderByKey[r._sampleKey] = r._originalOrder;
  }
  let available = kept.map((r) => r._sampleKey);

  // Step 3: sequential selection
  const groupSummaries: GroupSummary[] = [];
  const assignments: AssignmentRecord[] = [];

  for (const rule of groups) {
    const { selectedKeys, bestScore } = pickBest(available, norm, orderByKey, rule.size);
    const pickedSet = new Set(selectedKeys);
    available = available.filter((k) => !pickedSet.has(k));

    groupSummaries.push({
      group: rule.name,
      sampleIds: selectedKeys.map((k) => recordByKey[k].id),
      score: bestScore.score,
      maxRange: bestScore.maxRange,
      rangeVariance: bestScore.rangeVariance,
    });

    for (const key of selectedKeys) {
      const row = recordByKey[key];
      assignments.push({
        group: rule.name,
        sampleId: row.id,
        score: bestScore.score,
        maxRange: bestScore.maxRange,
        rangeVariance: bestScore.rangeVariance,
        QD1st: row.QD1st,
        GR1: row.GR1,
        FVG: row.FVG,
        KU: row.KU,
        QD1stNorm: norm[key].QD1st,
        GR1Norm: norm[key].GR1,
        FVGNorm: norm[key].FVG,
        KUNorm: norm[key].KU,
      });
    }
  }

  const remaining: RemainingRecord[] = available.map((k) => ({
    id: recordByKey[k].id,
    metrics: { QD1st: recordByKey[k].QD1st, GR1: recordByKey[k].GR1, FVG: recordByKey[k].FVG, KU: recordByKey[k].KU },
  }));

  const removed: RemovedRecord[] = removedRecs.map((r) => ({
    id: r.id,
    reason: r._removedReason,
    zScore: r._capacityZScore ?? 0,
    metrics: { QD1st: r.QD1st, GR1: r.GR1, FVG: r.FVG, KU: r.KU },
  }));

  return { assignments, groups: groupSummaries, removed, remaining, warnings };
}
