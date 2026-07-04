import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { HtCycle } from '../../entities/ht-cycle.entity';
import { DataParser, findHeaderRow, normalizeHeaders, toNumberOrNull, toStringOrNull } from './parser.interface';

const CELL_NAME_KEYS = ['cellname', 'cellid', 'batteryid', 'cell', '电芯名称', '电芯'];

/**
 * HtCycleStepParser — 读取机器导出的「循环层」cycle sheet，
 * 每行一个循环号 + 放电容量，汇总为 HtCycle 业务行。
 *
 * 提取规则:
 *   dischargeCapacity = 放电容量(Ah)
 *   capacityRetention  = (dischargeCapacity / baselineCapacity) × 100%
 *
 * 基准圈: 由于"规定第一圈"受工步调整影响不确定，默认为 cycle=1。
 *         可通过 baselineCycleNo 参数覆盖。
 */
export class HtCycleStepParser implements DataParser<HtCycle> {
  readonly tableName = 'htCycle';

  /** 基准循环号——默认为 1，可通过构造参数覆盖 */
  baselineCycleNo: number = 1;

  detect(sheet: Worksheet, assayType?: string): boolean {
    if (assayType && assayType !== 'HtCycle') return false;

    const name = (sheet.name || '').toLowerCase();
    if (name.includes('cycle') || name.includes('循环') || name.includes('htcycle')) return true;

    const { headers } = findHeaderRow(sheet, ['循环号', 'cycle', '放电容量']);
    const normalized = normalizeHeaders(headers);

    const hasCycle = normalized.some((h) => /循环号|cycle/i.test(h));
    const hasCap = normalized.some((h) => /放电容量|capacity|cap/i.test(h));
    // Must NOT match the step sheet format (has 工步类型)
    const isStep = normalized.some((h) => /工步类型|step type/i.test(h));

    return hasCycle && hasCap && !isStep;
  }

  parse(sheet: Worksheet, experimentId: string): HtCycle[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(
      sheet,
      ['循环号', 'cycle', '放电容量', 'capacity'],
    );
    const headers = normalizeHeaders(rawHeaders);

    const cycleCol  = headers.findIndex((h) => /循环号|cycle/i.test(h));
    const capCol    = headers.findIndex((h) => /放电容量|capacity|cap/i.test(h));
    const cellCol   = headers.findIndex((h) => CELL_NAME_KEYS.includes(h.trim().toLowerCase()));

    const rows: HtCycle[] = [];

    // First pass: collect all raw values
    const rawPairs: { cellName: string; cycle: number; cap: number | null }[] = [];

    sheet.eachRow((row, rowNum) => {
      if (rowNum <= rowNumber) return;

      const cellName = cellCol >= 0
        ? (toStringOrNull(row.getCell(cellCol).value) ?? sheet.name)
        : sheet.name;

      const cycle = toNumberOrNull(row.getCell(cycleCol).value);
      const cap   = toNumberOrNull(row.getCell(capCol).value);

      if (cycle == null) return;

      rawPairs.push({ cellName, cycle, cap });
    });

    // Find baseline capacity per cell
    const baselineByCell = new Map<string, number>();
    for (const rp of rawPairs) {
      if (rp.cycle === this.baselineCycleNo && rp.cap != null) {
        baselineByCell.set(rp.cellName, rp.cap);
      }
    }

    // Emit rows with computed retention
    for (const rp of rawPairs) {
      const baselineCap = baselineByCell.get(rp.cellName);
      const retention = (rp.cap != null && baselineCap != null && baselineCap !== 0)
        ? (rp.cap / baselineCap) * 100
        : null;

      rows.push({
        id: uuid(),
        experimentId,
        cellName: rp.cellName,
        cycle: rp.cycle,
        dischargeCapacity: rp.cap != null ? rp.cap.toFixed(6) : null,
        capacityRetention: retention != null ? retention.toFixed(6) : null,
        ironDissolution: null,
        createdAt: new Date(),
      } as HtCycle);
    }

    return rows;
  }
}
