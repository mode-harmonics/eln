import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { RawStepData } from '../../entities/raw-step-data.entity';
import { findHeaderRow, normalizeHeaders, toNumberOrNull, toStringOrNull } from './parser.interface';

const CELL_NAME_KEYS = ['cellname', 'cellid', 'batteryid', 'cell', '电芯名称', '电芯', '电池编号'];

export interface StepCols {
  cycleNo: number;
  stepNo: number;
  stepSeqNo: number;
  stepType: number;
  stepTime: number;
  capacity: number;
  startVolt: number;
  endVolt: number;
  startCurr: number;
  endCurr: number;
  cellName: number;
}

/**
 * Read all rows from a step-format sheet into RawStepData entities.
 * Returns steps grouped by cellName. Used by both CalendarLifeStepParser
 * and DcrTestStepParser.
 *
 * @param dataSource - Optional source tag ('formation' | 'grading') for ProcessData experiments.
 */
export function readStepSheet(sheet: Worksheet, experimentId: string, filename?: string, attachmentId?: string, dataSource?: string): {
  steps: RawStepData[];
  byCell: Map<string, RawStepData[]>;
  cols: StepCols;
} {
  const { rowNumber, headers: rawHeaders } = findHeaderRow(
    sheet,
    ['工步类型', '容量', '结束电压', '结束电流', 'step type'],
  );
  const headers = normalizeHeaders(rawHeaders);

  const cols: StepCols = {
    cycleNo: headers.findIndex((h) => /循环号|cycle/.test(h)),
    stepNo: headers.findIndex((h) => /^工步号?|^step no|^step$/.test(h)),
    stepSeqNo: headers.findIndex((h) => /工步序号|step seq|^seq/.test(h)),
    stepType: headers.findIndex((h) => /工步类型|step type/i.test(h)),
    stepTime: headers.findIndex((h) => /工步时间|step time|duration/i.test(h)),
    capacity: Math.max(
      headers.findIndex((h) => /容量|capacity/i.test(h)),
      headers.findIndex((h) => /能量|energy/i.test(h)),
    ),
    startVolt: headers.findIndex((h) => /起始电压|start volt/i.test(h)),
    endVolt: headers.findIndex((h) => /结束电压|end volt/i.test(h)),
    startCurr: headers.findIndex((h) => /起始电流|start curr/i.test(h)),
    endCurr: headers.findIndex((h) => /结束电流|end curr/i.test(h)),
    cellName: headers.findIndex((h) => CELL_NAME_KEYS.includes(h.trim().toLowerCase())),
  };

  const steps: RawStepData[] = [];
  const byCell = new Map<string, RawStepData[]>();

  sheet.eachRow((row, rowNumberCurrent) => {
    if (rowNumberCurrent <= rowNumber) return;

    const cellIdFromFilename = filename ? filename.replace(/\.[^/.]+$/, "") : null;
    const defaultCellName = cellIdFromFilename || sheet.name;

    const cellName = cols.cellName >= 1
      ? (toStringOrNull(row.getCell(cols.cellName).value) ?? defaultCellName)
      : defaultCellName;

    const stepType = cols.stepType >= 1 ? toStringOrNull(row.getCell(cols.stepType).value) : null;
    if (!stepType) return;

    const step = {
      id: uuid(),
      experimentId,
      attachmentId: attachmentId || null,
      cellName,
      cycleNo: cols.cycleNo >= 1 ? (toNumberOrNull(row.getCell(cols.cycleNo).value) ?? 0) : 0,
      stepNo: cols.stepNo >= 1 ? (toNumberOrNull(row.getCell(cols.stepNo).value) ?? 0) : 0,
      stepSeqNo: cols.stepSeqNo >= 1 ? (toNumberOrNull(row.getCell(cols.stepSeqNo).value) ?? 0) : 0,
      stepType,
      stepTime: toStringOrNull(cols.stepTime >= 1 ? row.getCell(cols.stepTime).value : null),
      capacity: cols.capacity >= 1 ? toNumberOrNull(row.getCell(cols.capacity).value)?.toString() ?? null : null,
      startVoltage: cols.startVolt >= 1 ? toNumberOrNull(row.getCell(cols.startVolt).value)?.toString() ?? null : null,
      endVoltage: cols.endVolt >= 1 ? toNumberOrNull(row.getCell(cols.endVolt).value)?.toString() ?? null : null,
      startCurrent: cols.startCurr >= 1 ? toNumberOrNull(row.getCell(cols.startCurr).value)?.toString() ?? null : null,
      endCurrent: cols.endCurr >= 1 ? toNumberOrNull(row.getCell(cols.endCurr).value)?.toString() ?? null : null,
      dataSource: dataSource || null,
      createdAt: new Date(),
    } as RawStepData;
    steps.push(step);

    const cellSteps = byCell.get(cellName) ?? [];
    cellSteps.push(step);
    byCell.set(cellName, cellSteps);
  });

  return { steps, byCell, cols };
}

/** Compute DCR in mΩ: |restVoltage - pulseVoltage| / |current| × 1000 */
export function computeDcr_mOhm(
  restVoltage: string | null,
  pulseVoltage: string | null,
  current: string | null,
): number | null {
  if (restVoltage == null || pulseVoltage == null || current == null) return null;
  const rv = Number(restVoltage), pv = Number(pulseVoltage), ci = Number(current);
  if (ci === 0) return null;
  return (Math.abs(rv - pv) / Math.abs(ci)) * 1000;
}

/** Detect whether a sheet looks like a machine step sheet. */
export function isStepSheet(sheet: Worksheet): boolean {
  const name = (sheet.name || '').toLowerCase();
  if (name.includes('step') || name.includes('工步')) return true;
  const { headers } = findHeaderRow(sheet, ['工步类型', '容量', '结束电压', '结束电流']);
  const normalized = normalizeHeaders(headers);
  return (
    normalized.some((h) => h.includes('工步类型') || h.includes('steptype')) &&
    normalized.some((h) => h.includes('容量') || h.includes('capacity'))
  );
}
