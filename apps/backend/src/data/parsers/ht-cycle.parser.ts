import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { HtCycle } from '../../entities/ht-cycle.entity';
import { DataParser, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

/**
 * htCycle — source sheets use cycle number as the time axis (one row per
 * cycle) with one column PER CELL for capacity, plus an optional sibling
 * "retention" column per cell (e.g. "A001" and "A001_ret"). This parser
 * keeps the row-per-cycle shape but folds all per-cell columns into a
 * single JSONB `caps` dict: { "A001": 2.15, "A001_ret": 99.5, ... }.
 *
 * Computed field (stored in `caps` at parse time):
 *   caps[bId + "_ret"] = (cap / baseCap) * 100    容量保持率 (%)
 *   where baseCap = the capacity at the first (lowest) cycle number.
 *
 * If the source sheet already includes an explicit `_ret` column for a
 * battery, that measured value is kept as-is; the fallback computation
 * only fills in missing retention values.
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
    const notesCol = lowerHeaders.findIndex((h) => ['notes', 'note', 'remark', 'remarks', '备注'].includes(h));

    // Split columns: raw capacity columns vs explicit _ret columns (case-insensitive)
    const capColumns: Array<{ colIndex: number; key: string }> = [];
    rawHeaders.forEach((header, colIndex) => {
      if (colIndex === cycleCol || colIndex === notesCol) return;
      const key = header.trim();
      if (key) {
        capColumns.push({ colIndex, key });
      }
    });

    // Identify which battery IDs have explicit _ret columns in the source
    const retKeysInSource = new Set(
      capColumns
        .filter(({ key }) => key.toLowerCase().endsWith('_ret'))
        .map(({ key }) => key.replace(/_ret$/i, '').toLowerCase()),
    );

    // Collect all rows first (sorted by cycle ascending for base-row lookup)
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
        notes: notesCol >= 0 ? toStringOrNull(row.getCell(notesCol).value) : null,
      });
    });

    // ─── Second pass: compute missing _ret values from first-cycle baseline ─
    if (rows.length > 0) {
      rows.sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));

      const baseRow = rows[0];
      const baseCaps = baseRow.caps ?? {};

      // Identify battery IDs that need computed retention (no explicit _ret column)
      const batteryIds = Object.keys(baseCaps).filter((k) => !k.endsWith('_ret'));

      for (const row of rows) {
        const caps = row.caps!;
        for (const bId of batteryIds) {
          const retKey = `${bId}_ret`;
          // Skip if already provided by the source sheet
          if (retKeysInSource.has(bId.toLowerCase())) continue;
          // Skip if already populated
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