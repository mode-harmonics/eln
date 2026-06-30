import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { CalendarLife } from '../../entities/calendar-life.entity';
import { RawStepData } from '../../entities/raw-step-data.entity';
import { DataParser } from './parser.interface';
import { computeDcr_mOhm, isStepSheet, readStepSheet } from './step-parser.shared';

/** Internal: raw parsed values for one DCR pulse cycle. */
interface DcrCycle {
  capacityQ: string | null;
  ddrcRestV: string | null;
  ddrcPulseV: string | null;
  ddrcCurrent: string | null;
  cdcrRestV: string | null;
  cdcrPulseV: string | null;
  cdcrCurrent: string | null;
}

/**
 * CalendarLifeStepParser �?读取机器导出的「工步层」step sheet�?
 * 先原样落库到 RawStepData，再�?DCR 测试循环自动汇总为 CalendarLife 业务行�?
 *
 * 汇总规�?
 *   1. Q0d = 首个 DCR 循环中工步号=7 的容�?
 *   2. 每次 DCR 循环�?DQ = 工步�?7 的容量（存储后首次放电容量）
 *   3. DDCR = |V_end(step13) - V_end(step12)| / |I_end(step13)| × 1000 (mΩ)
 *   4. CDCR = |V_end(step15) - V_end(step14)| / |I_end(step15)| × 1000 (mΩ)
 */
export class CalendarLifeStepParser implements DataParser<CalendarLife> {
  readonly tableName = 'calendarLife';
  rawSteps: RawStepData[] | null = null;

  getRawSteps(): RawStepData[] { return this.rawSteps ?? []; }

  detect(sheet: Worksheet, recordType?: string): boolean {
    if (recordType && recordType !== 'CalendarLife') return false;
    return isStepSheet(sheet);
  }

  parse(sheet: Worksheet, experimentId: string): CalendarLife[] {
    const { steps, byCell } = readStepSheet(sheet, experimentId);
    this.rawSteps = steps;

    const result: CalendarLife[] = [];

    for (const [cellName, cellSteps] of byCell) {
      cellSteps.sort((a, b) => a.stepSeqNo - b.stepSeqNo);

      const cycles: DcrCycle[] = [];
      let cur: DcrCycle | null = null;

      for (const s of cellSteps) {
        if (s.stepNo === 7 && s.stepType.includes('放电')) {
          cur = {
            capacityQ: s.capacity,
            ddrcRestV: null, ddrcPulseV: null, ddrcCurrent: null,
            cdcrRestV: null, cdcrPulseV: null, cdcrCurrent: null,
          };
          cycles.push(cur);
          continue;
        }
        if (!cur) continue;
        if (s.stepNo === 12) cur.ddrcRestV = s.endVoltage;
        if (s.stepNo === 13) { cur.ddrcPulseV = s.endVoltage; cur.ddrcCurrent = s.endCurrent; }
        if (s.stepNo === 14) cur.cdcrRestV = s.endVoltage;
        if (s.stepNo === 15) { cur.cdcrPulseV = s.endVoltage; cur.cdcrCurrent = s.endCurrent; }
      }

      if (cycles.length === 0) continue;

      const baseline = cycles[0];
      const Q0d = baseline.capacityQ;

      for (let i = 0; i < cycles.length; i++) {
        const c = cycles[i];
        const dayCount = i * 7;

        const ddrcVal = computeDcr_mOhm(c.ddrcRestV, c.ddrcPulseV, c.ddrcCurrent);
        const cdcrVal = computeDcr_mOhm(c.cdcrRestV, c.cdcrPulseV, c.cdcrCurrent);
        const dqVal   = c.capacityQ;

        const row: Partial<CalendarLife> = {
          id: uuid(), experimentId, cellName, dayCount,
          q:    i === 0 ? Q0d : null,
          dq:   dqVal,
          ddcr: ddrcVal != null ? ddrcVal.toFixed(6) : null,
          cdcr: cdcrVal != null ? cdcrVal.toFixed(6) : null,
          u: null, r: null,
          qRetention: null, qRecovery: null, ddcrGrowth: null, cdcrGrowth: null,
          uGrowth: null, rGrowth: null,
        };

        if (i === 0) {
          row.qRetention  = Q0d != null ? '100.000000' : null;
          row.qRecovery   = Q0d != null ? '100.000000' : null;
          row.ddcrGrowth  = '0.000000';
          row.cdcrGrowth  = '0.000000';
          row.uGrowth     = '0.000000';
          row.rGrowth     = '0.000000';
        } else {
          const Q0n = Q0d != null ? Number(Q0d) : null;
          if (dqVal != null && Q0n) row.qRetention = ((Number(dqVal) / Q0n) * 100).toFixed(6);
          const ddcr0 = computeDcr_mOhm(baseline.ddrcRestV, baseline.ddrcPulseV, baseline.ddrcCurrent);
          if (ddrcVal != null && ddcr0) row.ddcrGrowth = ((ddrcVal / ddcr0 - 1) * 100).toFixed(6);
          const cdcr0 = computeDcr_mOhm(baseline.cdcrRestV, baseline.cdcrPulseV, baseline.cdcrCurrent);
          if (cdcrVal != null && cdcr0) row.cdcrGrowth = ((cdcrVal / cdcr0 - 1) * 100).toFixed(6);
        }

        result.push(row as CalendarLife);
      }
    }

    return result;
  }
}
