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
 * fastCharge — source sheets lay each cell's step-charge ladder out
 * horizontally (step1_rate, step1_cutOffVoltage, ..., step2_rate, ...).
 * This parser folds that variable-length ladder into a single JSONB
 * `steps` array, since the step count varies by charge recipe.
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

      const steps = Array.from(stepsByNo.values())
        .sort((a, b) => (a.stepNo ?? 0) - (b.stepNo ?? 0))
        .map((s) => ({
          stepNo: s.stepNo ?? 0,
          rate: s.rate ?? null,
          cutOffVoltage: s.cutOffVoltage ?? null,
          current: s.current ?? null,
          stepCapacity: s.stepCapacity ?? null,
          stepTime: s.stepTime ?? null,
        })) as FastChargeStep[];

      const c0 = c0Col >= 0 ? toNumberOrNull(row.getCell(c0Col).value) : null;
      const providedTime =
        providedTimeCol >= 0 ? toNumberOrNull(row.getCell(providedTimeCol).value) : null;

      rows.push({
        id: uuid(),
        experimentId,
        cellName,
        c0: c0 !== null ? String(c0) : null,
        providedFastChargeTime: providedTime !== null ? String(providedTime) : null,
        steps,
      });
    });

    return rows;
  }
}