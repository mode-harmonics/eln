import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { EnergyEfficiency } from '../../entities/energy-efficiency.entity';
import { DataParser, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

/**
 * energyEfficiency — flat one-row-per-cell sheet: discharge energy (de),
 * charge energy (ce), and an optional anomaly note.
 */
export class EnergyEfficiencyParser implements DataParser<Partial<EnergyEfficiency>> {
  readonly tableName = 'energyEfficiency';

  detect(sheet: Worksheet): boolean {
    const headers = readHeaderRow(sheet).map((h) => h.trim().toLowerCase());
    return headers.includes('de') && headers.includes('ce');
  }

  parse(sheet: Worksheet, experimentId: string): Partial<EnergyEfficiency>[] {
    const headers = readHeaderRow(sheet).map((h) => h.trim().toLowerCase());
    const cellNameCol = headers.findIndex((h) => ['cellname', 'cellid', 'batteryid'].includes(h));
    const deCol = headers.indexOf('de');
    const ceCol = headers.indexOf('ce');
    const notesCol = headers.findIndex((h) => ['notes', 'note', 'remark', 'remarks'].includes(h));

    const rows: Partial<EnergyEfficiency>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cellName = cellNameCol >= 0 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      const de = deCol >= 0 ? toNumberOrNull(row.getCell(deCol).value) : null;
      const ce = ceCol >= 0 ? toNumberOrNull(row.getCell(ceCol).value) : null;

      rows.push({
        id: uuid(),
        experimentId,
        cellName,
        de: de !== null ? String(de) : null,
        ce: ce !== null ? String(ce) : null,
        notes: notesCol >= 0 ? toStringOrNull(row.getCell(notesCol).value) : null,
      });
    });

    return rows;
  }
}