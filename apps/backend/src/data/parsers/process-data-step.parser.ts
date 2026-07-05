import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { RawStepData } from '../../entities/raw-step-data.entity';
import { ProcessData } from '../../entities/process-data.entity';
import { DataParser } from './parser.interface';
import { isStepSheet, readStepSheet } from './step-parser.shared';

/**
 * ProcessDataStepParser �?读取机器导出的「工步层」step sheet�?
 * 同时提取化成数据（形成容量）和定容数据（分容容量），汇总为 ProcessData 业务行�?
 *
 * ── 化成（formation）──
 *   fq1 = stepNo=2 恒流充电容量
 *   fq2 = stepNo=4 恒流充电容量
 *
 * ── 定容（grading）──
 *   gqc1 = stepNo=2 恒流充电容量       // 第一步充电
 *   gqd1 = stepNo=4 恒流放电容量       // 第一步放电
 *   gqc2 = stepNo=6 恒流充电容量       // 第二步充电
 *   gu1  = stepNo=6 结束电压           // 分容后电压
 *
 *   gr1  = |V_end(step8) - V_end(step7)| / |I_end(step8)|
 *          (第二步放电结束电压- 上一步静置结束电压) / |第二步放电结束电流|
 */
export class ProcessDataStepParser implements DataParser<ProcessData> {
  readonly tableName = 'processData';
  rawSteps: RawStepData[] | null = null;

  getRawSteps(): RawStepData[] { return this.rawSteps ?? []; }

  detect(sheet: Worksheet, assayType?: string): boolean {
    if (assayType && assayType !== 'ProcessData') return false;
    return isStepSheet(sheet);
  }

  parse(sheet: Worksheet, experimentId: string, filename?: string, attachmentId?: string): ProcessData[] {
    const { steps, byCell } = readStepSheet(sheet, experimentId, filename, attachmentId);
    this.rawSteps = steps;

    const result: ProcessData[] = [];

    for (const [cellName, cellSteps] of byCell) {
      cellSteps.sort((a, b) => a.stepSeqNo - b.stepSeqNo);

      // ── Formation ──
      let fq1: string | null = null;
      let fq2: string | null = null;

      // ── Grading ──
      let gqc1: string | null = null;
      let gqd1: string | null = null;
      let gqc2: string | null = null;
      let gu1: string | null = null;
      let restVolt: string | null = null;   // stepNo=7 结束电压
      let pulseVolt: string | null = null;  // stepNo=8 结束电压
      let pulseCurr: string | null = null;  // stepNo=8 结束电流

      // Determine layout: grading sheet has stepNo=6, formation sheet stops at stepNo=4
      const isGradingSheet = cellSteps.some((s) => s.stepNo >= 6);

      let hasData = false;

      for (const s of cellSteps) {
        const isCharge = s.stepType.includes('充电');
        const isDischarge = s.stepType.includes('放电');

        if (isGradingSheet) {
          // ── Grading layout ──
          if (s.stepNo === 2 && isCharge && s.capacity != null) {
            gqc1 = s.capacity; hasData = true;
          }
          if (s.stepNo === 4 && isDischarge && s.capacity != null) {
            gqd1 = s.capacity; hasData = true;
          }
          if (s.stepNo === 6 && isCharge) {
            if (s.capacity != null) { gqc2 = s.capacity; hasData = true; }
            if (s.endVoltage != null) gu1 = s.endVoltage;
          }
          if (s.stepNo === 7 && s.stepType.includes('搁置') && s.endVoltage != null) {
            restVolt = s.endVoltage;
          }
          if (s.stepNo === 8 && isDischarge) {
            if (s.endVoltage != null) pulseVolt = s.endVoltage;
            if (s.endCurrent != null) pulseCurr = s.endCurrent;
          }
        } else {
          // ── Formation layout ──
          if (s.stepNo === 2 && isCharge && s.capacity != null) {
            fq1 = s.capacity; hasData = true;
          }
          if (s.stepNo === 4 && isCharge && s.capacity != null) {
            fq2 = s.capacity; hasData = true;
          }
        }
      }

      if (!hasData) continue;

      // Computed fields
      const fq1n = fq1 != null ? Number(fq1) : null;
      const fq2n = fq2 != null ? Number(fq2) : null;
      const fq = (fq1n != null && fq2n != null) ? (fq1n + fq2n).toFixed(6) : null;

      let gr1: string | null = null;
      if (restVolt != null && pulseVolt != null && pulseCurr != null) {
        const rv = Number(restVolt), pv = Number(pulseVolt), ci = Math.abs(Number(pulseCurr));
        // GR1 = (放电结束电压 - 静置结束电压) / |放电结束电流|
        if (ci !== 0) gr1 = ((pv - rv) / ci).toFixed(6);
      }

      result.push({
        id: uuid(),
        experimentId,
        attachmentId: attachmentId || null,
        cellId: cellName,
        fq1, fq2, fq,
        gqc1, gqd1, gqc2, gu1, gr1,
        m0: null, m1: null, m2: null, m3: null, m4: null,
        v0: null, v1: null,
        fu0: null, fr0: null, fu1: null, fr1: null, fu2: null, fr2: null,
        gu0: null, gr0: null,
        mIn: null, mLoss: null, mHold: null, fvg: null, ku: null,
        qcFirst: null, qdFirst: null, ceFirst: null,
        createdAt: new Date(),
      } as ProcessData);
    }

    return result;
  }
}
