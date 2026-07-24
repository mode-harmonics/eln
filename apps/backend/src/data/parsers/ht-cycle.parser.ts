import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { HtCycle } from '../../entities/ht-cycle.entity';
import { DataParser, findHeaderRow, normalizeHeaders, toNumberOrNull, toStringOrNull } from './parser.interface';

/**
 * htCycle — 长周期衰减验证数据
 * Handles both the horizontal (wide) layout where columns represent battery capacities,
 * and the vertical (long) layout where each row represents a single cycle for a single battery.
 */
function parseIronValue(val: any): number | null {
  if (val == null) return null;
  const str = String(val).trim();
  const num = parseFloat(str);
  if (!isNaN(num)) return num;
  const match = str.match(/([\d.]+)/);
  if (match) {
    const parsed = parseFloat(match[1]);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export class HtCycleParser implements DataParser<Partial<HtCycle>> {
  readonly tableName = 'htCycle';

  detect(sheet: Worksheet): boolean {
    if (sheet.name.includes('高温循环') || sheet.name.toLowerCase().includes('htcycle') || sheet.name.toLowerCase().includes('ht-cycle')) {
      return true;
    }
    const { headers } = findHeaderRow(sheet, ['cycle', '循环圈数']);
    const normalized = normalizeHeaders(headers);
    return normalized.includes('cycle');
  }

  parse(sheet: Worksheet, experimentId: string, _filename?: string, attachmentId?: string): Partial<HtCycle>[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(sheet, ['cycle', '循环圈数']);
    const headers = normalizeHeaders(rawHeaders);
    
    const cellIdCol = headers.findIndex((h) => ['cellid', 'batteryid', 'cellname'].includes(h));
    const cycleCol = headers.indexOf('cycle');
    const ironCol = headers.findIndex((h) => ['iron', 'fe', '铁溶出量', '铁溶出', '铁', 'notes', 'remark', '备注'].includes(h));

    const rawRecords: Array<{
      cellName: string;
      cycle: number;
      dischargeCapacity: number | null;
      capacityRetention: number | null;
      ironDissolution: number | null;
    }> = [];

    if (cellIdCol >= 1) {
      // VERTICAL LAYOUT: each row represents a cell's cycle record
      const capCol = headers.indexOf('capacity');
      const retCol = headers.indexOf('retention');

      sheet.eachRow((row, rowNum) => {
        if (rowNum <= rowNumber) return;

        const cellName = cellIdCol >= 1 ? toStringOrNull(row.getCell(cellIdCol).value) : null;
        const cycleVal = cycleCol >= 1 ? toNumberOrNull(row.getCell(cycleCol).value) : null;
        if (!cellName || cycleVal === null) return;

        const capVal = capCol >= 1 ? toNumberOrNull(row.getCell(capCol).value) : null;
        const retVal = retCol >= 1 ? toNumberOrNull(row.getCell(retCol).value) : null;
        const ironVal = ironCol >= 1 ? parseIronValue(row.getCell(ironCol).value) : null;

        rawRecords.push({
          cellName,
          cycle: cycleVal,
          dischargeCapacity: capVal,
          capacityRetention: retVal,
          ironDissolution: ironVal,
        });
      });
    } else {
      // HORIZONTAL LAYOUT: each row is a cycle, columns are cells
      const capColumns: Array<{ colIndex: number; key: string }> = [];
      rawHeaders.forEach((header, colIndex) => {
        if (colIndex === cycleCol || colIndex === ironCol) return;
        const key = header.trim();
        if (key) {
          capColumns.push({ colIndex, key });
        }
      });

      sheet.eachRow((row, rowNumberCurrent) => {
        if (rowNumberCurrent <= rowNumber) return;

        const cycleValue = cycleCol >= 1 ? toNumberOrNull(row.getCell(cycleCol).value) : null;
        if (cycleValue === null) return;

        const ironVal = ironCol >= 1 ? parseIronValue(row.getCell(ironCol).value) : null;

        const cellNames = Array.from(new Set(
          capColumns.map(({ key }) => key.replace(/_ret$/i, ''))
        ));

        for (const cellName of cellNames) {
          const capColIndex = capColumns.find(({ key }) => key.toLowerCase() === cellName.toLowerCase())?.colIndex;
          const retColIndex = capColumns.find(({ key }) => key.toLowerCase() === `${cellName.toLowerCase()}_ret`)?.colIndex;

          const capVal = capColIndex !== undefined && capColIndex >= 1 ? toNumberOrNull(row.getCell(capColIndex).value) : null;
          const retVal = retColIndex !== undefined && retColIndex >= 1 ? toNumberOrNull(row.getCell(retColIndex).value) : null;

          if (capVal !== null || retVal !== null) {
            rawRecords.push({
              cellName,
              cycle: cycleValue,
              dischargeCapacity: capVal,
              capacityRetention: retVal,
              ironDissolution: ironVal,
            });
          }
        }
      });
    }

    // Now calculate missing retention relative to cycle baseline
    const cellGroups = new Map<string, typeof rawRecords>();
    for (const rec of rawRecords) {
      const list = cellGroups.get(rec.cellName) ?? [];
      list.push(rec);
      cellGroups.set(rec.cellName, list);
    }

    const finalRecords: Partial<HtCycle>[] = [];
    for (const records of cellGroups.values()) {
      records.sort((a, b) => a.cycle - b.cycle);
      const baseCap = records.find(r => r.dischargeCapacity != null)?.dischargeCapacity ?? 0;

      for (const rec of records) {
        let ret = rec.capacityRetention;
        if (rec.dischargeCapacity != null && ret === null && baseCap !== 0) {
          ret = Number(((rec.dischargeCapacity / baseCap) * 100).toFixed(6));
        }

        finalRecords.push({
          id: uuid(),
          experimentId,
          attachmentId: attachmentId || null,
          cycle: rec.cycle,
          cellName: rec.cellName,
          ironDissolution: rec.ironDissolution != null ? String(rec.ironDissolution) : null,
          dischargeCapacity: rec.dischargeCapacity != null ? String(rec.dischargeCapacity) : null,
          capacityRetention: ret != null ? String(ret) : null,
        });
      }
    }

    return finalRecords;
  }
}