import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { FastCharge, FastChargeStep } from '../../entities/fast-charge.entity';
import { DataParser, findHeaderRow, normalizeHeaders, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

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
export function computeFastChargeTime(c0: number, steps: FastChargeStep[]): number | null {
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
 * fastCharge — 快充时间工步表
 * Handles both the horizontal (wide) step-ladder layout and the vertical (long) step-by-step layout.
 */
export class FastChargeParser implements DataParser<Partial<FastCharge>> {
  readonly tableName = 'fastCharge';

  detect(sheet: Worksheet): boolean {
    if (sheet.name.includes('快充') || sheet.name.toLowerCase().includes('fast')) {
      return true;
    }
    const { headers } = findHeaderRow(sheet, ['step1_rate', '工步号', '倍率', '电池编号', 'batteryid', 'cellid']);
    const normalized = normalizeHeaders(headers);
    return normalized.some((h) => STEP_HEADER_RE.test(h.trim())) || 
      (normalized.includes('cellid') && normalized.some((h) => ['stepno', 'step_no', '工步号'].includes(h)));
  }

  parse(sheet: Worksheet, experimentId: string): Partial<FastCharge>[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(sheet, ['工步号', 'stepno', 'step_no']);
    const headers = normalizeHeaders(rawHeaders);

    const cellIdCol = headers.findIndex((h) => ['cellid', 'batteryid', 'cellname'].includes(h));
    const stepNoCol = headers.findIndex((h) => ['stepno', 'step_no', '工步号'].includes(h));
    const cutOffVoltageCol = headers.findIndex((h) => ['cutoffvoltage', 'cut_off_voltage', '全电截止电压'].includes(h));
    const currentCol = headers.findIndex((h) => ['current', '电流'].includes(h));
    const rateCol = headers.findIndex((h) => ['rate', '倍率'].includes(h));
    const stepCapacityCol = headers.findIndex((h) => ['stepcapacity', 'step_capacity', '单步容量'].includes(h));
    const stepTimeCol = headers.findIndex((h) => ['steptime', 'step_time', '单步时间(min)', '单步时间'].includes(h));
    const providedTimeCol = headers.findIndex((h) =>
      ['providedfastchargetime', 'fastchargetime', '10%-80%soc(min)', '10%-80%soc'].includes(h.toLowerCase())
    );

    const isVertical = cellIdCol >= 0 && stepNoCol >= 0;

    if (isVertical) {
      // VERTICAL LAYOUT: each row represents a single step of a battery
      const cellMap = new Map<string, {
        providedTime: number | null;
        steps: Array<{
          stepNo: number;
          rate: string | number | null;
          cutOffVoltage: number | null;
          current: number | null;
          stepCapacity: number | null;
          stepTime: number | null;
        }>;
      }>();

      sheet.eachRow((row, rowNum) => {
        if (rowNum <= rowNumber) return;

        const cellName = toStringOrNull(row.getCell(cellIdCol).value);
        const stepNoVal = toNumberOrNull(row.getCell(stepNoCol).value);
        if (!cellName || stepNoVal === null) return;

        const rateVal = rateCol >= 0 ? toStringOrNull(row.getCell(rateCol).value) : null;
        const cutOffVoltageVal = cutOffVoltageCol >= 0 ? toNumberOrNull(row.getCell(cutOffVoltageCol).value) : null;
        const currentVal = currentCol >= 0 ? toNumberOrNull(row.getCell(currentCol).value) : null;
        const stepCapacityVal = stepCapacityCol >= 0 ? toNumberOrNull(row.getCell(stepCapacityCol).value) : null;
        const providedTimeVal = providedTimeCol >= 0 ? toNumberOrNull(row.getCell(providedTimeCol).value) : null;
        
        let stepTimeVal: number | null = null;
        if (stepTimeCol >= 0) {
          stepTimeVal = toNumberOrNull(row.getCell(stepTimeCol).value);
        }

        const record = cellMap.get(cellName) ?? { providedTime: null, steps: [] };
        if (providedTimeVal !== null) {
          record.providedTime = providedTimeVal;
        }
        record.steps.push({
          stepNo: stepNoVal,
          rate: rateVal,
          cutOffVoltage: cutOffVoltageVal,
          current: currentVal,
          stepCapacity: stepCapacityVal,
          stepTime: stepTimeVal,
        });
        cellMap.set(cellName, record);
      });

      const rows: Partial<FastCharge>[] = [];

      for (const [cellName, record] of cellMap.entries()) {
        const rawSteps = record.steps;
        rawSteps.sort((a, b) => a.stepNo - b.stepNo);

        const c0 = 3.0; // default nominal capacity fallback
        let cumulativeSoc = 0;

        const steps: FastChargeStep[] = rawSteps.map((s) => {
          const stepCapacity = s.stepCapacity ?? null;
          // Normalize capacity if in mAh (greater than 15)
          const capAh = (stepCapacity !== null && stepCapacity > 15) ? stepCapacity / 1000 : stepCapacity;
          const stepSoc = (capAh !== null && c0 > 0) ? capAh / c0 : null;
          cumulativeSoc += stepSoc ?? 0;
          return {
            stepNo:       s.stepNo,
            rate:         s.rate,
            cutOffVoltage: s.cutOffVoltage,
            current:      s.current,
            stepCapacity,
            stepTime:     s.stepTime,
            stepSoc:      stepSoc !== null ? Number(stepSoc.toFixed(6)) : null,
            cumulativeSoc: Number(cumulativeSoc.toFixed(6)),
          };
        });

        const computedTime = computeFastChargeTime(c0, steps);
        const finalTime = record.providedTime ?? computedTime;

        rows.push({
          id: uuid(),
          experimentId,
          cellName,
          c0: String(c0),
          providedFastChargeTime: record.providedTime !== null ? String(record.providedTime) : null,
          computedFastChargeTime: finalTime !== null ? finalTime.toFixed(6) : null,
          steps,
        });
      }

      return rows;
    } else {
      // HORIZONTAL LAYOUT: wide format where step columns are flattened horizontally
      const stepColumns: Array<{ colIndex: number; stepNo: number; field: keyof FastChargeStep }> = [];
      rawHeaders.forEach((header, colIndex) => {
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

      sheet.eachRow((row, rowNumberCurrent) => {
        if (rowNumberCurrent <= rowNumber) return;

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

        const providedTime = providedTimeCol >= 0 ? toNumberOrNull(row.getCell(providedTimeCol).value) : null;
        const computedTime = computeFastChargeTime(c0, steps);

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
}