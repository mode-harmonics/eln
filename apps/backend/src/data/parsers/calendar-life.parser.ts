import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { CalendarLife } from '../../entities/calendar-life.entity';
import { DataParser, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

/** Matches headers like q_0d, ddcr_7d, u_14d, r_0D, dq_21d (case-insensitive). */
const DAY_HEADER_RE = /^(q|dq|ddcr|cdcr|u|r)_(\d+)d$/i;

interface ParsedHeader {
  colIndex: number;
  metric: 'q' | 'dq' | 'ddcr' | 'cdcr' | 'u' | 'r';
  dayCount: number;
}

/**
 * calendarLife — source workbooks lay each cell out as ONE row with many
 * day-indexed columns (q_0d, q_7d, ddcr_0d, ddcr_7d, ...). This parser
 * flattens that wide row into one output row per (cellName, dayCount),
 * then applies the 4 fallback rules from BACKEND_SPEC.md §二.10:
 *
 *   1. Missing q_0d -> backfill with the first later day that has a value.
 *   2. ddcr_Xd / cdcr_Xd -> if one side is 0/missing, copy from the other.
 *   3. Missing r_0d or u_0d -> backfill from the first later day's r_Xd/u_Xd.
 *   4. Missing dq_Xd -> compute as ((q_Xd - q_0d) / q_0d) * 100.
 */
export class CalendarLifeParser implements DataParser<Partial<CalendarLife>> {
  readonly tableName = 'calendarLife';

  detect(sheet: Worksheet): boolean {
    const headers = readHeaderRow(sheet);
    return headers.some((h) => DAY_HEADER_RE.test(h.trim()));
  }

  parse(sheet: Worksheet, experimentId: string): Partial<CalendarLife>[] {
    const headers = readHeaderRow(sheet);
    const parsedHeaders: ParsedHeader[] = [];

    headers.forEach((header, colIndex) => {
      const match = DAY_HEADER_RE.exec(header.trim());
      if (match) {
        parsedHeaders.push({
          colIndex,
          metric: match[1].toLowerCase() as ParsedHeader['metric'],
          dayCount: parseInt(match[2], 10),
        });
      }
    });

    const cellNameCol = headers.findIndex((h) =>
      ['cellname', 'cellid', 'batteryid'].includes(h.trim().toLowerCase()),
    );

    const allRows: Partial<CalendarLife>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cellName = cellNameCol >= 0 ? toStringOrNull(row.getCell(cellNameCol).value) : null;
      if (!cellName) return;

      // Group this cell's values by dayCount: { 0: { q, dq, ddcr, cdcr, u, r }, 7: {...}, ... }
      const byDay = new Map<number, Record<string, number | null>>();

      for (const ph of parsedHeaders) {
        const value = toNumberOrNull(row.getCell(ph.colIndex).value);
        const existing = byDay.get(ph.dayCount) ?? {};
        existing[ph.metric] = value;
        byDay.set(ph.dayCount, existing);
      }

      const sortedDays = Array.from(byDay.keys()).sort((a, b) => a - b);

      this.applyFallbackRules(byDay, sortedDays);

      for (const dayCount of sortedDays) {
        const metrics = byDay.get(dayCount)!;
        allRows.push({
          id: uuid(),
          experimentId,
          cellName,
          isHorizontal: true,
          dayCount,
          q: metrics.q !== undefined && metrics.q !== null ? String(metrics.q) : null,
          dq: metrics.dq !== undefined && metrics.dq !== null ? String(metrics.dq) : null,
          ddcr: metrics.ddcr !== undefined && metrics.ddcr !== null ? String(metrics.ddcr) : null,
          cdcr: metrics.cdcr !== undefined && metrics.cdcr !== null ? String(metrics.cdcr) : null,
          u: metrics.u !== undefined && metrics.u !== null ? String(metrics.u) : null,
          r: metrics.r !== undefined && metrics.r !== null ? String(metrics.r) : null,
        });
      }
    });

    return allRows;
  }

  /** Mutates byDay in place, applying the 4 fallback rules in spec order. */
  private applyFallbackRules(
    byDay: Map<number, Record<string, number | null>>,
    sortedDays: number[],
  ): void {
    if (sortedDays.length === 0) return;

    const isEmpty = (v: number | null | undefined) => v === null || v === undefined || v === 0;

    // Rule 1: missing q_0d -> backfill with first later day that has a value.
    const day0 = byDay.get(sortedDays[0]);
    if (day0 && isEmpty(day0.q)) {
      const fallbackDay = sortedDays.find((d) => !isEmpty(byDay.get(d)?.q));
      if (fallbackDay !== undefined) {
        day0.q = byDay.get(fallbackDay)!.q;
      }
    }

    // Rule 2: ddcr_Xd / cdcr_Xd mutual copy when one side is empty.
    for (const day of sortedDays) {
      const metrics = byDay.get(day)!;
      if (isEmpty(metrics.ddcr) && !isEmpty(metrics.cdcr)) {
        metrics.ddcr = metrics.cdcr;
      } else if (isEmpty(metrics.cdcr) && !isEmpty(metrics.ddcr)) {
        metrics.cdcr = metrics.ddcr;
      }
    }

    // Rule 3: missing r_0d or u_0d -> backfill from first later day's r_Xd/u_Xd.
    const day0Again = byDay.get(sortedDays[0]);
    if (day0Again) {
      if (isEmpty(day0Again.r)) {
        const fallbackDay = sortedDays.find((d) => !isEmpty(byDay.get(d)?.r));
        if (fallbackDay !== undefined) {
          day0Again.r = byDay.get(fallbackDay)!.r;
        }
      }
      if (isEmpty(day0Again.u)) {
        const fallbackDay = sortedDays.find((d) => !isEmpty(byDay.get(d)?.u));
        if (fallbackDay !== undefined) {
          day0Again.u = byDay.get(fallbackDay)!.u;
        }
      }
    }

    // Rule 4: missing dq_Xd -> compute ((q_Xd - q_0d) / q_0d) * 100.
    const q0 = byDay.get(sortedDays[0])?.q;
    if (!isEmpty(q0)) {
      for (const day of sortedDays) {
        const metrics = byDay.get(day)!;
        if (isEmpty(metrics.dq) && !isEmpty(metrics.q)) {
          metrics.dq = ((metrics.q! - q0!) / q0!) * 100;
        }
      }
    }
  }
}