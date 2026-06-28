import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { CalendarLife } from '../../entities/calendar-life.entity';
import { DataParser, findHeaderRow, normalizeHeaders, readHeaderRow, toNumberOrNull, toStringOrNull } from './parser.interface';

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
 *
 * After flattening, a second pass computes 6 derived metrics relative to
 * the day=0 row for each cell (stored directly; see CalendarLife entity):
 *
 *   qRetention  = (dq   / q_0d)    * 100
 *   qRecovery   = (q    / q_0d)    * 100
 *   ddcrGrowth  = (ddcr / ddcr_0d - 1) * 100
 *   cdcrGrowth  = (cdcr / cdcr_0d - 1) * 100
 *   uGrowth     = (u    / u_0d   - 1) * 100
 *   rGrowth     = (r    / r_0d   - 1) * 100
 */
export class CalendarLifeParser implements DataParser<Partial<CalendarLife>> {
  readonly tableName = 'calendarLife';

  detect(sheet: Worksheet): boolean {
    if (sheet.name.includes('日历') || sheet.name.toLowerCase().includes('calendar')) {
      return true;
    }
    const { headers } = findHeaderRow(sheet, ['q0d', 'q_0d', 'q7d', 'q_7d', 'ddcr0d', 'ddcr_0d']);
    const normalized = normalizeHeaders(headers);
    return normalized.some((h) => DAY_HEADER_RE.test(h.trim()));
  }

  parse(sheet: Worksheet, experimentId: string): Partial<CalendarLife>[] {
    const { rowNumber, headers: rawHeaders } = findHeaderRow(sheet, ['q0d', 'q_0d', 'q7d', 'q_7d', 'ddcr0d', 'ddcr_0d']);
    const headers = normalizeHeaders(rawHeaders);
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

    sheet.eachRow((row, rowNumberCurrent) => {
      if (rowNumberCurrent <= rowNumber) return;

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

      // ─── First pass: emit raw rows ────────────────────────────────────────
      const cellRows: Partial<CalendarLife>[] = [];
      for (const dayCount of sortedDays) {
        const metrics = byDay.get(dayCount)!;
        cellRows.push({
          id: uuid(),
          experimentId,
          cellName,
          isHorizontal: true,
          dayCount,
          q:    metrics.q    != null ? String(metrics.q)    : null,
          dq:   metrics.dq   != null ? String(metrics.dq)   : null,
          ddcr: metrics.ddcr != null ? String(metrics.ddcr) : null,
          cdcr: metrics.cdcr != null ? String(metrics.cdcr) : null,
          u:    metrics.u    != null ? String(metrics.u)    : null,
          r:    metrics.r    != null ? String(metrics.r)    : null,
          // computed fields filled in second pass below
          qRetention:  null,
          qRecovery:   null,
          ddcrGrowth:  null,
          cdcrGrowth:  null,
          uGrowth:     null,
          rGrowth:     null,
        });
      }

      // ─── Second pass: compute derived metrics relative to day=0 ──────────
      const day0Row = cellRows.find((r) => r.dayCount === 0);
      if (day0Row) {
        const q0    = day0Row.q    != null ? Number(day0Row.q)    : null;
        const ddcr0 = day0Row.ddcr != null ? Number(day0Row.ddcr) : null;
        const cdcr0 = day0Row.cdcr != null ? Number(day0Row.cdcr) : null;
        const u0    = day0Row.u    != null ? Number(day0Row.u)    : null;
        const r0    = day0Row.r    != null ? Number(day0Row.r)    : null;

        for (const r of cellRows) {
          const dqVal   = r.dq   != null ? Number(r.dq)   : null;
          const qVal    = r.q    != null ? Number(r.q)    : null;
          const ddcrVal = r.ddcr != null ? Number(r.ddcr) : null;
          const cdcrVal = r.cdcr != null ? Number(r.cdcr) : null;
          const uVal    = r.u    != null ? Number(r.u)    : null;
          const rVal    = r.r    != null ? Number(r.r)    : null;

          if (r.dayCount === 0) {
            // Baseline day: ratios are 100 / growth is 0
            r.qRetention = q0 != null ? '100.000000' : null;
            r.qRecovery  = q0 != null ? '100.000000' : null;
            r.ddcrGrowth = '0.000000';
            r.cdcrGrowth = '0.000000';
            r.uGrowth    = '0.000000';
            r.rGrowth    = '0.000000';
          } else {
            r.qRetention = (dqVal != null && q0)   ? ((dqVal / q0) * 100).toFixed(6)             : null;
            r.qRecovery  = (qVal  != null && q0)   ? ((qVal  / q0) * 100).toFixed(6)             : null;
            r.ddcrGrowth = (ddcrVal != null && ddcr0) ? ((ddcrVal / ddcr0 - 1) * 100).toFixed(6) : null;
            r.cdcrGrowth = (cdcrVal != null && cdcr0) ? ((cdcrVal / cdcr0 - 1) * 100).toFixed(6) : null;
            r.uGrowth    = (uVal  != null && u0)   ? ((uVal    / u0   - 1) * 100).toFixed(6)     : null;
            r.rGrowth    = (rVal  != null && r0)   ? ((rVal    / r0   - 1) * 100).toFixed(6)     : null;
          }
        }
      }

      allRows.push(...cellRows);
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

    // Rule 4: missing dq_Xd -> compute as ((q_Xd - q_0d) / q_0d) * 100.
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