import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { HtCycle } from '../../entities/ht-cycle.entity';
import { DataParser, findHeaderRow, normalizeHeaders, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

/**
 * htCycle — 长周期衰减验证数据
 * Handles both the horizontal (wide) layout where columns represent battery capacities,
 * and the vertical (long) layout where each row represents a single cycle for a single battery.
 */
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

  parse(sheet: Worksheet, experimentId: string): Partial<HtCycle>[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(sheet, ['cycle', '循环圈数']);
    const headers = normalizeHeaders(rawHeaders);
    
    // Check if there is a battery ID column (which indicates a vertical layout)
    const cellIdCol = headers.findIndex((h) => ['cellid', 'batteryid', 'cellname'].includes(h));
    const cycleCol = headers.indexOf('cycle');
    const notesCol = headers.findIndex((h) => ['notes', 'remark'].includes(h));

    if (cellIdCol >= 0) {
      // VERTICAL LAYOUT: each row is a single (battery, cycle, capacity) record
      const capCol = headers.indexOf('capacity');
      const retCol = headers.indexOf('retention');

      const cycleMap = new Map<number, Record<string, number>>();
      const notesMap = new Map<number, string>();

      sheet.eachRow((row, rowNum) => {
        if (rowNum <= rowNumber) return;

        const cellName = toStringOrNull(row.getCell(cellIdCol).value);
        const cycleVal = toNumberOrNull(row.getCell(cycleCol).value);
        if (!cellName || cycleVal === null) return;

        const capVal = capCol >= 0 ? toNumberOrNull(row.getCell(capCol).value) : null;
        const retVal = retCol >= 0 ? toNumberOrNull(row.getCell(retCol).value) : null;
        const noteVal = notesCol >= 0 ? toStringOrNull(row.getCell(notesCol).value) : null;

        const caps = cycleMap.get(cycleVal) ?? {};
        if (capVal !== null) {
          caps[cellName] = capVal;
        }
        if (retVal !== null) {
          caps[`${cellName}_ret`] = retVal;
        }
        cycleMap.set(cycleVal, caps);

        if (noteVal) {
          notesMap.set(cycleVal, noteVal);
        }
      });

      const rows: Partial<HtCycle>[] = [];
      for (const [cycle, caps] of cycleMap.entries()) {
        rows.push({
          id: uuid(),
          experimentId,
          cycle,
          caps,
          notes: notesMap.get(cycle) ?? null,
        });
      }

      // Sort to ensure the base baseline (first cycle) is at rows[0]
      rows.sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));

      if (rows.length > 0) {
        const baseRow = rows[0];
        const baseCaps = baseRow.caps ?? {};
        const batteryIds = Object.keys(baseCaps).filter((k) => !k.endsWith('_ret'));

        for (const row of rows) {
          const caps = row.caps!;
          for (const bId of batteryIds) {
            const retKey = `${bId}_ret`;
            if (caps[retKey] !== undefined) continue;

            const baseCap = baseCaps[bId];
            const curCap = caps[bId];
            if (baseCap != null && baseCap !== 0 && curCap != null) {
              caps[retKey] = Number(((curCap / baseCap) * 100).toFixed(6));
            }
          }
        }
      }

      return rows;
    } else {
      // HORIZONTAL LAYOUT: each row represents a cycle number, columns represent cells
      // Split columns: raw capacity columns vs explicit _ret columns
      const capColumns: Array<{ colIndex: number; key: string }> = [];
      rawHeaders.forEach((header, colIndex) => {
        if (colIndex === cycleCol || colIndex === notesCol) return;
        const key = header.trim();
        if (key) {
          capColumns.push({ colIndex, key });
        }
      });

      const retKeysInSource = new Set(
        capColumns
          .filter(({ key }) => key.toLowerCase().endsWith('_ret'))
          .map(({ key }) => key.replace(/_ret$/i, '').toLowerCase()),
      );

      const rows: Partial<HtCycle>[] = [];

      sheet.eachRow((row, rowNumberCurrent) => {
        if (rowNumberCurrent <= rowNumber) return;

        const cycleValue = toNumberOrNull(row.getCell(cycleCol).value);
        if (cycleValue === null) return;

        const caps: Record<string, number> = {};
        for (const { colIndex, key } of capColumns) {
          const value = toNumberOrNull(row.getCell(colIndex).value);
          if (value !== null) {
            caps[key] = value;
          }
        }

        rows.push({
          id: uuid(),
          experimentId,
          cycle: cycleValue,
          caps,
          notes: notesCol >= 0 ? toStringOrNull(row.getCell(notesCol).value) : null,
        });
      });

      if (rows.length > 0) {
        rows.sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));

        const baseRow = rows[0];
        const baseCaps = baseRow.caps ?? {};
        const batteryIds = Object.keys(baseCaps).filter((k) => !k.endsWith('_ret'));

        for (const row of rows) {
          const caps = row.caps!;
          for (const bId of batteryIds) {
            const retKey = `${bId}_ret`;
            if (retKeysInSource.has(bId.toLowerCase())) continue;
            if (caps[retKey] !== undefined) continue;

            const baseCap = baseCaps[bId];
            const curCap = caps[bId];
            if (baseCap != null && baseCap !== 0 && curCap != null) {
              caps[retKey] = Number(((curCap / baseCap) * 100).toFixed(6));
            }
          }
        }
      }

      return rows;
    }
  }
}