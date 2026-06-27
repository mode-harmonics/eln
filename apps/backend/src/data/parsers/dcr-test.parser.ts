import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { DcrTest } from '../../entities/dcr-test.entity';
import { DataParser, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

const NUMERIC_FIELDS = ['q0', 'du0', 'du1', 'di', 'cu0', 'cu1', 'ci'] as const;

/**
 * dcrTest — flat one-row-per-cell sheet capturing 4C DCR pulse response:
 * pre/post-pulse voltage and current for both discharge and charge pulses.
 */
export class DcrTestParser implements DataParser<Partial<DcrTest>> {
  readonly tableName = 'dcrTest';

  detect(sheet: Worksheet): boolean {
    const headers = readHeaderRow(sheet).map((h) => h.trim().toLowerCase());
    return headers.includes('du0') && headers.includes('du1') && headers.includes('di');
  }

  parse(sheet: Worksheet, experimentId: string): Partial<DcrTest>[] {
    const headers = readHeaderRow(sheet).map((h) => h.trim().toLowerCase());
    const colIndex = (name: string) => headers.indexOf(name);
    const cellNameCol = headers.findIndex((h) => ['cellname', 'cellid', 'batteryid'].includes(h));

    const rows: Partial<DcrTest>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cellName = cellNameCol >= 0 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      const record: Partial<DcrTest> = { id: uuid(), experimentId, cellName };

      for (const field of NUMERIC_FIELDS) {
        const col = colIndex(field);
        if (col >= 0) {
          const value = toNumberOrNull(row.getCell(col).value);
          (record as Record<string, unknown>)[field] = value !== null ? String(value) : null;
        }
      }

      rows.push(record);
    });

    return rows;
  }
}