import { Workbook, Worksheet } from 'exceljs';

/**
 * Build an in-memory ExcelJS worksheet from a header row + data rows.
 * Useful for parser unit tests — no file I/O needed.
 *
 * @example
 * ```ts
 * const ws = buildWorksheet([
 *   ['cellId', 'fu0', 'fr0', 'fq1'],
 *   ['C001',  3.85, 12.5, 2.15],
 * ]);
 * ```
 */
export function buildWorksheet(rows: unknown[][]): Worksheet {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Sheet1');

  rows.forEach((row) => ws.addRow(row));

  return ws;
}

/**
 * Helper that builds a worksheet, runs `parser.detect()`, and asserts it
 * returns true. Throws a descriptive error if detection fails.
 */
export function assertDetected(
  parser: { detect: (sheet: Worksheet) => boolean; readonly tableName: string },
  ws: Worksheet,
): void {
  if (!parser.detect(ws)) {
    throw new Error(
      `❌ ${parser.tableName} parser.detect() returned false for input that should have been detected.`,
    );
  }
}
