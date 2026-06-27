import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { ProcessData } from '../../entities/process-data.entity';
import { DataParser, readHeaderRow, toBooleanOrFalse, toNumberOrNull, toStringOrNull } from './parser.interface';

const NUMERIC_FIELDS = [
  'm0', 'm1', 'm2',
  'v0', 'v1',
  'fu0', 'fr0',
  'fq1', 'fq2',
  'fu1', 'fr1', 'fu2', 'fr2',
  'm3', 'm4',
  'gu0', 'gr0',
  'gqc1', 'gqd1', 'gqc2',
  'gu1', 'gr1',
] as const;

/**
 * processData — flat per-cell manufacturing parameters (weight, voltage,
 * internal resistance across formation / aging / grading). Each data row
 * maps 1:1 to a column by lowercased header name.
 */
export class ProcessDataParser implements DataParser<Partial<ProcessData>> {
  readonly tableName = 'processData';

  detect(sheet: Worksheet): boolean {
    const headers = readHeaderRow(sheet).map((h) => h.toLowerCase());
    // Distinctive columns for this sheet: cellId/batteryId plus formation (f*) and grading (g*) fields.
    const hasCellId = headers.some((h) => h === 'cellid' || h === 'batteryid');
    const hasFormationFields = headers.some((h) => h === 'fu0' || h === 'fq1');
    const hasGradingFields = headers.some((h) => h === 'gu0' || h === 'gqc1');
    return hasCellId && (hasFormationFields || hasGradingFields);
  }

  parse(sheet: Worksheet, experimentId: string): Partial<ProcessData>[] {
    const headers = readHeaderRow(sheet).map((h) => h.toLowerCase());
    const colIndex = (name: string) => headers.indexOf(name);
    const cellIdCol = colIndex('cellid') >= 0 ? colIndex('cellid') : colIndex('batteryid');

    const rows: Partial<ProcessData>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header

      const cellId = toStringOrNull(row.getCell(cellIdCol).value);
      if (!cellId) return; // skip blank trailing rows

      const record: Partial<ProcessData> = {
        id: uuid(),
        experimentId,
        cellId,
      };

      for (const field of NUMERIC_FIELDS) {
        const col = colIndex(field);
        if (col >= 0) {
          (record as Record<string, unknown>)[field] = toNumberOrNull(row.getCell(col).value);
        }
      }

      rows.push(record);
    });

    return rows;
  }
}