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