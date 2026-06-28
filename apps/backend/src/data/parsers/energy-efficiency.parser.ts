import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { EnergyEfficiency } from '../../entities/energy-efficiency.entity';
import { DataParser, findHeaderRow, normalizeHeaders, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

/**
 * energyEfficiency — flat one-row-per-cell sheet: discharge energy (de),
 * charge energy (ce), and an optional anomaly note.
 *
 * Computed fields written at parse time:
 *   ee    = de / ce           能量效率 (ratio)
 *   eePct = (de / ce) * 100   能量效率 (%)
 */
export class EnergyEfficiencyParser implements DataParser<Partial<EnergyEfficiency>> {
  readonly tableName = 'energyEfficiency';

  detect(sheet: Worksheet): boolean {
    if (sheet.name.includes('能效') || sheet.name.toLowerCase().includes('efficiency')) {
      return true;
    }
    const { headers } = findHeaderRow(sheet, ['de', 'ce', 'ee']);
    const normalized = normalizeHeaders(headers);
    return normalized.includes('de') && normalized.includes('ce');
  }

  parse(sheet: Worksheet, experimentId: string): Partial<EnergyEfficiency>[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(sheet, ['de', 'ce', 'ee']);
    const headers = normalizeHeaders(rawHeaders);
    const cellNameCol = headers.findIndex((h) => ['cellname', 'cellid', 'batteryid'].includes(h));
    const deCol = headers.indexOf('de');
    const ceCol = headers.indexOf('ce');

    const rows: Partial<EnergyEfficiency>[] = [];

    sheet.eachRow((row, rowNumberCurrent) => {
      if (rowNumberCurrent <= rowNumber) return;

      const cellName = cellNameCol >= 0 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      const de = deCol >= 0 ? toNumberOrNull(row.getCell(deCol).value) : null;
      const ce = ceCol >= 0 ? toNumberOrNull(row.getCell(ceCol).value) : null;

      // ─── Compute derived fields ─────────────────────────────────────────────
      const ee    = (de != null && ce != null && ce !== 0) ? de / ce                  : null;

      rows.push({
        id: uuid(),
        experimentId,
        cellName,
        de:    de    != null ? String(de)            : null,
        ce:    ce    != null ? String(ce)            : null,
        ee:    ee    != null ? ee.toFixed(6)         : null,
      });
    });

    return rows;
  }
}