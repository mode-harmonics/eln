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
 *
 * After flattening, a second pass computes the derived gas production rate
 * relative to the day=0 volume for each cell (stored directly):
 *
 *   vg = (v - v_0d) / qd1st    产气量 (mL/Ah)
 *   (day=0 row: vg = 0)
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

    const allRows: Partial<StorageSwelling>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cellName = cellNameCol >= 0 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      const qd1stValue = qd1stCol >= 0 ? toNumberOrNull(row.getCell(qd1stCol).value) : null;

      // ─── First pass: emit raw rows sorted by dayCount ─────────────────────
      const cellRows: Partial<StorageSwelling>[] = [];
      for (const { colIndex, dayCount } of dayColumns) {
        const v = toNumberOrNull(row.getCell(colIndex).value);
        cellRows.push({
          id: uuid(),
          experimentId,
          cellName,
          qd1st: qd1stValue !== null ? String(qd1stValue) : null,
          dayCount,
          v: v !== null ? String(v) : null,
          vg: null, // filled in second pass
        });
      }

      // Sort to ensure day=0 is first
      cellRows.sort((a, b) => (a.dayCount ?? 0) - (b.dayCount ?? 0));

      // ─── Second pass: compute vg relative to day=0 ───────────────────────
      const day0Row = cellRows.find((r) => r.dayCount === 0);
      if (day0Row) {
        const v0  = day0Row.v    != null ? Number(day0Row.v)    : null;
        const qd  = qd1stValue;

        for (const r of cellRows) {
          if (r.dayCount === 0) {
            r.vg = '0.000000';
          } else {
            const vNd = r.v != null ? Number(r.v) : null;
            r.vg = (vNd != null && v0 != null && qd != null && qd !== 0)
              ? ((vNd - v0) / qd).toFixed(6)
              : null;
          }
        }
      }

      allRows.push(...cellRows);
    });

    return allRows;
  }
}