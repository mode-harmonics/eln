import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { HtCycle } from '../../entities/ht-cycle.entity';
import { DataParser, readHeaderRow, toNumberOrNull } from './parser.interface';

/**
 * htCycle — source sheets use cycle number as the time axis (one row per
 * cycle) with one column PER CELL for capacity, plus an optional sibling
 * "retention" column per cell (e.g. "A001" and "A001_ret"). This parser
 * keeps the row-per-cycle shape but folds all per-cell columns into a
 * single JSONB `caps` dict: { "A001": 2.15, "A001_ret": 99.5, ... }.
 */
export class HtCycleParser implements DataParser<Partial<HtCycle>> {
  readonly tableName = 'htCycle';

  detect(sheet: Worksheet): boolean {
    const headers = readHeaderRow(sheet).map((h) => h.trim().toLowerCase());
    return headers.includes('cycle');
  }

  parse(sheet: Worksheet, experimentId: string): Partial<HtCycle>[] {
    const rawHeaders = readHeaderRow(sheet);
    const lowerHeaders = rawHeaders.map((h) => h.trim().toLowerCase());
    const cycleCol = lowerHeaders.indexOf('cycle');

    // Every other column is a per-cell capacity or "<id>_ret" retention value.
    const capColumns: Array<{ colIndex: number; key: string }> = [];
    rawHeaders.forEach((header, colIndex) => {
      if (colIndex === cycleCol) return;
      const key = header.trim();
      if (key) {
        capColumns.push({ colIndex, key });
      }
    });

    const rows: Partial<HtCycle>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

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
      });
    });

    return rows;
  }
}