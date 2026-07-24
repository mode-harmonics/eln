import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { DcrTest } from '../../entities/dcr-test.entity';
import { DataParser, findHeaderRow, normalizeHeaders, toNumberOrNull, toStringOrNull } from './parser.interface';

const NUMERIC_FIELDS = ['q0', 'du0', 'du1', 'di', 'cu0', 'cu1', 'ci'] as const;

/**
 * dcrTest — flat one-row-per-cell sheet capturing 4C DCR pulse response:
 * pre/post-pulse voltage and current for both discharge and charge pulses.
 *
 * Computed fields written at parse time:
 *   ddcr       = |du1 - du0| / di      放电直流内阻 (Ω)
 *   cdcr       = |cu1 - cu0| / ci      充电直流内阻 (Ω)
 *   dRcProduct = q0 * ddcr             放电R-C乘积 (Ah·Ω)
 *   cRcProduct = q0 * cdcr             充电R-C乘积 (Ah·Ω)
 */
export class DcrTestParser implements DataParser<Partial<DcrTest>> {
  readonly tableName = 'dcrTest';

  detect(sheet: Worksheet): boolean {
    if (sheet.name.includes('DCR') || sheet.name.toLowerCase().includes('dcr')) {
      return true;
    }
    const { headers } = findHeaderRow(sheet, ['du0', 'du1', 'di', 'cu0', 'cu1', 'ci']);
    const normalized = normalizeHeaders(headers);
    return normalized.includes('du0') && normalized.includes('du1') && normalized.includes('di');
  }

  parse(sheet: Worksheet, experimentId: string, _filename?: string, attachmentId?: string): Partial<DcrTest>[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(sheet, ['du0', 'du1', 'di', 'cu0', 'cu1', 'ci']);
    const headers = normalizeHeaders(rawHeaders);
    const colIndex = (name: string) => headers.indexOf(name);
    const cellNameCol = headers.findIndex((h) => ['cellname', 'cellid', 'batteryid'].includes(h));

    const rows: Partial<DcrTest>[] = [];

    sheet.eachRow((row, rowNumberCurrent) => {
      if (rowNumberCurrent <= rowNumber) return;

      const cellName = cellNameCol >= 1 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      const record: Partial<DcrTest> = {
        id: uuid(),
        experimentId,
        attachmentId: attachmentId || null,
        cellName,
      };


      for (const field of NUMERIC_FIELDS) {
        const col = colIndex(field);
        if (col >= 1) {
          const value = toNumberOrNull(row.getCell(col).value);
          (record as Record<string, unknown>)[field] = value !== null ? String(value) : null;
        }
      }

      // ─── Compute derived fields ─────────────────────────────────────────────
      const q0  = record.q0  != null ? Number(record.q0)  : null;
      const du0 = record.du0 != null ? Number(record.du0) : null;
      const du1 = record.du1 != null ? Number(record.du1) : null;
      const di  = record.di  != null ? Number(record.di)  : null;
      const cu0 = record.cu0 != null ? Number(record.cu0) : null;
      const cu1 = record.cu1 != null ? Number(record.cu1) : null;
      const ci  = record.ci  != null ? Number(record.ci)  : null;

      const ddcr = (du0 != null && du1 != null && di != null && di !== 0)
        ? Math.abs(du1 - du0) / di
        : null;

      const cdcr = (cu0 != null && cu1 != null && ci != null && ci !== 0)
        ? Math.abs(cu1 - cu0) / ci
        : null;

      const dRcProduct = (q0 != null && ddcr != null) ? q0 * ddcr : null;
      const cRcProduct = (q0 != null && cdcr != null) ? q0 * cdcr : null;

      record.ddcr       = ddcr       != null ? ddcr.toFixed(6)       : null;
      record.cdcr       = cdcr       != null ? cdcr.toFixed(6)       : null;
      record.dRcProduct = dRcProduct != null ? dRcProduct.toFixed(6) : null;
      record.cRcProduct = cRcProduct != null ? cRcProduct.toFixed(6) : null;

      rows.push(record);
    });

    return rows;
  }
}