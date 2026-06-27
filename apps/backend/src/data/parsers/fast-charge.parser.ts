import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { FastCharge, FastChargeStep } from '../../entities/fast-charge.entity';
import { DataParser, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

/**
 * Matches step-ladder column headers like:
 *   step1_rate, step1_cutoffvoltage, step1_current, step1_capacity, step1_time
 * Step number and field name are captured for grouping.
 */
const STEP_HEADER_RE = /^step(\d+)_(rate|cutoffvoltage|current|capacity|time)$/i;

const FIELD_TO_KEY: Record<string, keyof FastChargeStep> = {
  rate: 'rate',
  cutoffvoltage: 'cutOffVoltage',
  current: 'current',
  capacity: 'stepCapacity',
  time: 'stepTime',
};

/**
 * Computes the 10%→80% SOC fast-charge duration (minutes) from a step ladder,
 * using the same linear-interpolation algorithm as the front-end:
 *
 *   1. Build a timeline of (cumulativeSoc, elapsedTime) break-points.
 *   2. Linearly interpolate to find t10 and t80.
 *   3. Return max(0, t80 - t10).
 */
function computeFastChargeTime(c0: number, steps: FastChargeStep[]): number | null {
  if (c0 <= 0 || !steps || steps.length === 0) return null;

  const points: { soc: number; time: number }[] = [{ soc: 0, time: 0 }];
  let cumSoc = 0;
  let cumTime = 0;

  for (const step of steps) {
    const cap = step.stepCapacity ?? 0;
    const dur = step.stepTime ?? 0;
    cumSoc  += cap / c0;
    cumTime += dur;
    points.push({ soc: cumSoc, time: cumTime });
  }

  const getTimeForSoc = (target: number): number => {
    if (target <= 0) return 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (target >= p1.soc && target <= p2.soc) {
        if (p2.soc === p1.soc) return p1.time;
        return p1.time + ((target - p1.soc) / (p2.soc - p1.soc)) * (p2.time - p1.time);
      }
    }
    return points[points.length - 1].time; // target > max reached SOC
  };

  const t10 = getTimeForSoc(0.10);
  const t80 = getTimeForSoc(0.80);
  return Math.max(0, t80 - t10);
}

/**
 * fastCharge — source sheets lay each cell's step-charge ladder out
 * horizontally (step1_rate, step1_cutOffVoltage, ..., step2_rate, ...).
 * This parser folds that variable-length ladder into a single JSONB
 * `steps` array, since the step count varies by charge recipe.
 *
 * Computed fields written at parse time:
 *   steps[i].stepSoc       = stepCapacity / c0          单步SOC增量
 *   steps[i].cumulativeSoc = cumulative sum of stepSoc   累计SOC
 *   computedFastChargeTime = t(80%SOC) - t(10%SOC)      10%-80%SOC快充时间 (min)
 */
export class FastChargeParser implements DataParser<Partial<FastCharge>> {
  readonly tableName = 'fastCharge';

  detect(sheet: Worksheet): boolean {
    const headers = readHeaderRow(sheet);
    return headers.some((h) => STEP_HEADER_RE.test(h.trim()));
  }

  parse(sheet: Worksheet, experimentId: string): Partial<FastCharge>[] {
    const headers = readHeaderRow(sheet);

    const stepColumns: Array<{ colIndex: number; stepNo: number; field: keyof FastChargeStep }> = [];
    headers.forEach((header, colIndex) => {
      const match = STEP_HEADER_RE.exec(header.trim());
      if (match) {
        const stepNo = parseInt(match[1], 10);
        const field = FIELD_TO_KEY[match[2].toLowerCase()];
        if (field) {
          stepColumns.push({ colIndex, stepNo, field });
        }
      }
    });

    const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
    const cellNameCol = lowerHeaders.findIndex((h) => ['cellname', 'cellid', 'batteryid'].includes(h));
    const c0Col = lowerHeaders.indexOf('c0');
    const providedTimeCol = lowerHeaders.findIndex((h) =>
      ['providedfastchargetime', 'fastchargetime'].includes(h),
    );

    const rows: Partial<FastCharge>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cellName = cellNameCol >= 0 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      const stepsByNo = new Map<number, Partial<FastChargeStep>>();
      for (const { colIndex, stepNo, field } of stepColumns) {
        const value = toNumberOrNull(row.getCell(colIndex).value);
        const step = stepsByNo.get(stepNo) ?? { stepNo };
        (step as Record<string, unknown>)[field] = value;
        stepsByNo.set(stepNo, step);
      }

      const c0Raw = c0Col >= 0 ? toNumberOrNull(row.getCell(c0Col).value) : null;
      const c0 = c0Raw ?? 0;

      // ─── Build sorted steps and compute per-step SOC fields ──────────────
      let cumulativeSoc = 0;
      const steps = Array.from(stepsByNo.values())
        .sort((a, b) => (a.stepNo ?? 0) - (b.stepNo ?? 0))
        .map((s) => {
          const stepCapacity = s.stepCapacity ?? null;
          const stepSoc = (stepCapacity !== null && c0 > 0) ? stepCapacity / c0 : null;
          cumulativeSoc += stepSoc ?? 0;
          return {
            stepNo:       s.stepNo ?? 0,
            rate:         s.rate ?? null,
            cutOffVoltage: s.cutOffVoltage ?? null,
            current:      s.current ?? null,
            stepCapacity,
            stepTime:     s.stepTime ?? null,
            stepSoc:      stepSoc !== null ? Number(stepSoc.toFixed(6)) : null,
            cumulativeSoc: Number(cumulativeSoc.toFixed(6)),
          } satisfies FastChargeStep;
        });

      // ─── Compute 10%–80% SOC fast-charge time ────────────────────────────
      const providedTime = providedTimeCol >= 0 ? toNumberOrNull(row.getCell(providedTimeCol).value) : null;
      const computedTime = computeFastChargeTime(c0, steps);

      // Use providedTime if available, otherwise fall back to computed value
      const finalTime = providedTime ?? computedTime;

      rows.push({
        id: uuid(),
        experimentId,
        cellName,
        c0:                    c0Raw !== null ? String(c0Raw) : null,
        providedFastChargeTime: providedTime !== null ? String(providedTime) : null,
        computedFastChargeTime: finalTime   !== null ? finalTime.toFixed(6) : null,
        steps,
      });
    });

    return rows;
  }
}