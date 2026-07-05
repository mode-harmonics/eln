import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { ProcessData } from '../../entities/process-data.entity';
import { DataParser, findHeaderRow, normalizeHeaders, readHeaderRow, toBooleanOrFalse, toNumberOrNull, toStringOrNull } from './parser.interface';

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

/** Safe number parse: returns null if val is null, else the numeric value. */
const n = (v: string | null | undefined): number | null => (v == null ? null : Number(v));

export class ProcessDataParser implements DataParser<Partial<ProcessData>> {
  readonly tableName = 'processData';

  detect(sheet: Worksheet): boolean {
    if (sheet.name.includes('制程') || sheet.name.toLowerCase().includes('process')) {
      return true;
    }
    const { headers } = findHeaderRow(sheet, ['m0', 'm1', 'fu0', 'gu0']);
    const normalized = normalizeHeaders(headers);
    const hasCellId = normalized.some((h) => h === 'cellid' || h === 'batteryid' || h === 'cellname');
    const hasFormationFields = normalized.some((h) => h === 'fu0' || h === 'fq1');
    const hasGradingFields = normalized.some((h) => h === 'gu0' || h === 'gqc1');
    return hasCellId && (hasFormationFields || hasGradingFields);
  }

  parse(sheet: Worksheet, experimentId: string, filename?: string, attachmentId?: string): Partial<ProcessData>[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(sheet, ['m0', 'm1', 'fu0', 'gu0']);
    const headers = normalizeHeaders(rawHeaders);
    const colIndex = (name: string) => headers.indexOf(name);
    const cellIdCol = colIndex('cellid') >= 1 ? colIndex('cellid') : (colIndex('batteryid') >= 1 ? colIndex('batteryid') : colIndex('cellname'));

    const rows: Partial<ProcessData>[] = [];

    sheet.eachRow((row, rowNumberCurrent) => {
      if (rowNumberCurrent <= rowNumber) return; // header and comments


      const cellId = cellIdCol >= 1 ? toStringOrNull(row.getCell(cellIdCol).value) : null;
      if (!cellId) return; // skip blank trailing rows

      const record: Partial<ProcessData> = {
        id: uuid(),
        experimentId,
        attachmentId: attachmentId || null,
        cellId,
      };

      for (const field of NUMERIC_FIELDS) {
        const col = colIndex(field);
        if (col >= 1) {
          const value = toNumberOrNull(row.getCell(col).value);
          (record as Record<string, unknown>)[field] = value !== null ? String(value) : null;
        }
      }

      // ─── Compute derived fields ─────────────────────────────────────────────
      const m0 = n(record.m0);
      const m1 = n(record.m1);
      const m2 = n(record.m2);
      const m4 = n(record.m4);
      const v0 = n(record.v0);
      const v1 = n(record.v1);
      const fq1 = n(record.fq1);
      const fq2 = n(record.fq2);
      const fu1 = n(record.fu1);
      const fu2 = n(record.fu2);
      const gqc1 = n(record.gqc1);
      const gqd1 = n(record.gqd1);

      const mIn    = m1 !== null && m0 !== null ? m1 - m0 : null;
      const mLoss  = m1 !== null && m2 !== null ? m1 - m2 : null;
      const mHold  = m4 !== null && m0 !== null ? m4 - m0 : null;
      const fq     = fq1 !== null && fq2 !== null ? fq1 + fq2 : null;
      const qdFirst = gqd1;
      const fvg    = v1 !== null && v0 !== null && qdFirst ? (v1 - v0) / qdFirst : null;
      const ku     = fu1 !== null && fu2 !== null ? fu1 - fu2 : null;
      const qcFirst = fq !== null && gqc1 !== null ? fq + gqc1 : null;
      const ceFirst = qdFirst !== null && qcFirst ? (qdFirst / qcFirst) * 100 : null;

      // Store as strings (matches decimal column type) with fixed precision
      record.mIn    = mIn    !== null ? mIn.toFixed(6)    : null;
      record.mLoss  = mLoss  !== null ? mLoss.toFixed(6)  : null;
      record.mHold  = mHold  !== null ? mHold.toFixed(6)  : null;
      record.fq     = fq     !== null ? fq.toFixed(6)     : null;
      record.qdFirst = qdFirst !== null ? String(qdFirst) : null;
      record.fvg    = fvg    !== null ? fvg.toFixed(6)    : null;
      record.ku     = ku     !== null ? ku.toFixed(6)     : null;
      record.qcFirst = qcFirst !== null ? qcFirst.toFixed(6) : null;
      record.ceFirst = ceFirst !== null ? ceFirst.toFixed(6) : null;

      rows.push(record);
    });

    return rows;
  }
}