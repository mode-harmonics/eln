import { Worksheet } from 'exceljs';

/**
 * Common contract implemented by every battery-science sheet parser.
 * ParserRegistry calls detect() on each candidate parser for a given
 * worksheet and dispatches to the first one that returns true.
 */
export interface DataParser<TRow = Record<string, unknown>> {
  /** Logical table name this parser produces rows for, e.g. 'processData'. */
  readonly tableName: string;

  /** Returns true if this worksheet's shape/headers match this parser. */
  detect(sheet: Worksheet): boolean;

  /** Parses the worksheet into row objects ready for repository.save(). */
  parse(sheet: Worksheet, experimentId: string): TRow[];
}

/** Shared helper: reads a worksheet's header row as trimmed lowercase strings. */
export function readHeaderRow(sheet: Worksheet, headerRowNumber = 1): string[] {
  const row = sheet.getRow(headerRowNumber);
  const headers: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });
  return headers;
}

/** Coerces an Excel cell value to a number, returning null for blanks/non-numeric. */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && value !== null && 'result' in (value as object)) {
    // ExcelJS formula cell: { formula, result }
    return toNumberOrNull((value as { result: unknown }).result);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerces an Excel cell value to a boolean ("是"/"true"/"1"/"yes" => true). */
export function toBooleanOrFalse(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', '是', '√', 'pass'].includes(s);
}

/** Coerces an Excel cell value to a trimmed string, or null if blank. */
export function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
}

/** Finds the header row by searching rows 1 to 5 for specific keywords. */
export function findHeaderRow(sheet: Worksheet, keywords: string[]): { rowNumber: number; headers: string[] } {
  for (let r = 1; r <= 5; r++) {
    const headers = readHeaderRow(sheet, r);
    const normalized: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      normalized[i] = String(headers[i] ?? '').trim().toLowerCase();
    }
    const hasKeyword = keywords.some(keyword => {
      const kw = keyword.toLowerCase();
      return normalized.some(h => h && h.includes(kw));
    });
    if (hasKeyword) {
      return { rowNumber: r, headers };
    }
  }
  return { rowNumber: 1, headers: readHeaderRow(sheet, 1) };
}

/** Normalizes headers by translating Chinese/alternate names and adding underscores to day-indexed headers. */
export function normalizeHeaders(headers: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const h = String(header ?? '').trim().toLowerCase();
    
    // Direct Chinese -> English translations
    if (h === '电池编号' || h === '电芯编号' || h === '电芯id' || h === '电池id' || h === '电芯名称' || h === '电池名称') {
      result[i] = 'cellid';
      continue;
    }
    if (h === '挑选电池' || h === '是否挑选' || h === '挑选' || h === '已挑选') {
      result[i] = 'picked';
      continue;
    }
    if (h === '放电能量') {
      result[i] = 'de';
      continue;
    }
    if (h === '充电能量') {
      result[i] = 'ce';
      continue;
    }
    if (h === '能量效率') {
      result[i] = 'ee';
      continue;
    }
    
    if (h === '放电初始电压') {
      result[i] = 'du0';
      continue;
    }
    if (h === '放电结束电压') {
      result[i] = 'du1';
      continue;
    }
    if (h === '放电电流') {
      result[i] = 'di';
      continue;
    }
    if (h === '放电dcr') {
      result[i] = 'ddcr';
      continue;
    }
    
    if (h === '充电初始电压') {
      result[i] = 'cu0';
      continue;
    }
    if (h === '充电结束电压') {
      result[i] = 'cu1';
      continue;
    }
    if (h === '充电电流') {
      result[i] = 'ci';
      continue;
    }
    if (h === '充电dcr') {
      result[i] = 'cdcr';
      continue;
    }
    
    if (h === '放电r-c乘积') {
      result[i] = 'drc';
      continue;
    }
    if (h === '充电r-c乘积') {
      result[i] = 'crc';
      continue;
    }
    if (h === '定容容量' || h === '标称容量' || h === '初始定容') {
      result[i] = 'q0';
      continue;
    }
    if (h === '循环圈数' || h === '循环周次') {
      result[i] = 'cycle';
      continue;
    }
    if (h === '备注') {
      result[i] = 'notes';
      continue;
    }
    if (h === '铁溶出量') {
      result[i] = 'iron';
      continue;
    }
    if (h === '放电容量' || h === '容量' || h === '放电容量(ah)') {
      result[i] = 'capacity';
      continue;
    }
    if (h === '容量保持率' || h === '保持率' || h === '容量保持率(%)') {
      result[i] = 'retention';
      continue;
    }

    // Normalize day-indexed headers: e.g., "q7d" -> "q_7d", "ddcr14d" -> "ddcr_14d"
    // Matches patterns like "q0d", "dq7d", "ddcr14d", "cdcr21d", "u28d", "r35d", "v42d", "vg49d"
    const match = /^([a-z\u0394]+)(\d+)d$/i.exec(h);
    if (match) {
      const metric = match[1];
      const day = match[2];
      
      let m = metric;
      if (m.startsWith('Δ')) {
        m = 'Δ' + m.slice(1);
      }
      result[i] = `${m}_${day}d`;
      continue;
    }
    
    result[i] = h;
  }
  return result;
}
