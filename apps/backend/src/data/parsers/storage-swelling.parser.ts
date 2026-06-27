import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { StorageSwelling } from '../../entities/storage-swelling.entity';
import { DataParser, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

/** Matches headers like v_0d, v_7d, v_14d (case-insensitive). */
const DAY_HEADER_RE = /^v_(\d+)d$/i;

/**
 * storageSwelling — same wide-to-vertical flattening shape as calendarLife,
 * but with a single time-series metric (swelling volume) plus a static
 * baseline reference capacity (qd1st) per cell.
 */
export class StorageSwellingParser implements DataParser<Partial<StorageSwelling>> {
  readonly tableName = 'storageSwelling';

  detect(sheet: Worksheet): boolean {
    const headers = readHeaderRow(sheet);
    const hasDayVolumeCols = headers.some((h) => DAY_HEADER_RE.test(h.trim()));
    const hasQd1st = headers.some((h) => h.trim().toLowerCase() === 'qd_1st' || h.trim().toLowerCase() === 'qd1st');
    return hasDayVolumeCols && hasQd1st;
  }

  parse(sheet: Worksheet, experimentId: string): Partial<StorageSwelling>[] {
    const headers = readHeaderRow(sheet);

    const dayColumns: Array<{ colIndex: number; dayCount: number }> = [];
    headers.forEach((header, colIndex) => {
      const match = DAY_HEADER_RE.exec(header.trim());
      if (match) {
        dayColumns.push({ colIndex, dayCount: parseInt(match[1], 10) });
      }
    });

    const cellNameCol = headers.findIndex((h) =>
      ['cellname', 'cellid', 'batteryid'].includes(h.trim().toLowerCase()),
    );
    const qd1stCol = headers.findIndex((h) => ['qd_1st', 'qd1st'].includes(h.trim().toLowerCase()));

    const rows: Partial<StorageSwelling>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cellName = cellNameCol >= 0 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      const qd1stValue = qd1stCol >= 0 ? toNumberOrNull(row.getCell(qd1stCol).value) : null;

      for (const { colIndex, dayCount } of dayColumns) {
        const v = toNumberOrNull(row.getCell(colIndex).value);
        rows.push({
          id: uuid(),
          experimentId,
          cellName,
          qd1st: qd1stValue !== null ? String(qd1stValue) : null,
          dayCount,
          v: v !== null ? String(v) : null,
        });
      }
    });

    return rows;
  }
}