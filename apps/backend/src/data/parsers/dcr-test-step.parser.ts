import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { RawStepData } from '../../entities/raw-step-data.entity';
import { DcrTest } from '../../entities/dcr-test.entity';
import { DataParser } from './parser.interface';
import { isStepSheet, readStepSheet } from './step-parser.shared';

/**
 * DcrTestStepParser �?读取机器导出的「工步层」step sheet�?
 * 提取 4C DCR 测试指标汇总为 DcrTest 业务行（每个电芯一行）�?
 *
 * 提取规则:
 *   Q0  = stepNo=7 容量（第三次放电�?
 *   DU0 = stepNo=12 结束电压（DDCR 脉冲前静置）
 *   DU1 = stepNo=13 结束电压（DDCR 脉冲�?
 *   DI  = stepNo=13 结束电流
 *   CU0 = stepNo=14 结束电压（CDCR 脉冲前静置）
 *   CU1 = stepNo=15 结束电压（CDCR 脉冲�?
 *   CI  = stepNo=15 结束电流
 *
 * 计算字段:
 *   ddcr       = |du1 - du0| / |di|      (Ω)
 *   cdcr       = |cu1 - cu0| / |ci|      (Ω)
 *   dRcProduct = q0 * ddcr               (Ah·Ω)
 *   cRcProduct = q0 * cdcr               (Ah·Ω)
 */
export class DcrTestStepParser implements DataParser<DcrTest> {
  readonly tableName = 'dcrTest';
  rawSteps: RawStepData[] | null = null;

  getRawSteps(): RawStepData[] { return this.rawSteps ?? []; }

  detect(sheet: Worksheet, recordType?: string): boolean {
    // Only match DcrTest experiments when recordType is provided
    if (recordType && recordType !== 'DcrTest') return false;
    return isStepSheet(sheet);
  }

  parse(sheet: Worksheet, experimentId: string): DcrTest[] {
    const { steps, byCell } = readStepSheet(sheet, experimentId);
    this.rawSteps = steps;

    const result: DcrTest[] = [];

    for (const [cellName, cellSteps] of byCell) {
      cellSteps.sort((a, b) => a.stepSeqNo - b.stepSeqNo);

      let q0: string | null = null;
      let du0: string | null = null;
      let du1: string | null = null;
      let di: string | null = null;
      let cu0: string | null = null;
      let cu1: string | null = null;
      let ci: string | null = null;

      for (const s of cellSteps) {
        // Q0 = 工步�?7 容量（第三次放电�?
        if (s.stepNo === 7 && s.stepType.includes('放电') && s.capacity != null) {
          q0 = s.capacity;
        }
        // DU0 = 工步�?12 结束电压
        if (s.stepNo === 12 && s.endVoltage != null) {
          du0 = s.endVoltage;
        }
        // DU1 + DI = 工步�?13
        if (s.stepNo === 13) {
          if (s.endVoltage != null) du1 = s.endVoltage;
          if (s.endCurrent != null) di = s.endCurrent;
        }
        // CU0 = 工步�?14 结束电压
        if (s.stepNo === 14 && s.endVoltage != null) {
          cu0 = s.endVoltage;
        }
        // CU1 + CI = 工步�?15
        if (s.stepNo === 15) {
          if (s.endVoltage != null) cu1 = s.endVoltage;
          if (s.endCurrent != null) ci = s.endCurrent;
        }
      }

      if (q0 == null && du0 == null && cu0 == null) continue;

      // 计算字段
      const ddcr = computeDcr_ohm(du0, du1, di);
      const cdcr = computeDcr_ohm(cu0, cu1, ci);
      const q0n  = q0 != null ? Number(q0) : null;
      const dRcProduct = (q0n != null && ddcr != null) ? (q0n * ddcr).toFixed(6) : null;
      const cRcProduct = (q0n != null && cdcr != null) ? (q0n * cdcr).toFixed(6) : null;

      result.push({
        id: uuid(),
        experimentId,
        cellName,
        q0,
        du0, du1, di,
        cu0, cu1, ci,
        ddcr:  ddcr != null ? ddcr.toFixed(6) : null,
        cdcr:  cdcr != null ? cdcr.toFixed(6) : null,
        dRcProduct,
        cRcProduct,
        createdAt: new Date(),
      } as DcrTest);
    }

    return result;
  }
}

/** Compute DCR in Ω: |restVoltage - pulseVoltage| / |current| */
function computeDcr_ohm(
  restV: string | null,
  pulseV: string | null,
  current: string | null,
): number | null {
  if (restV == null || pulseV == null || current == null) return null;
  const rv = Number(restV), pv = Number(pulseV), ci = Number(current);
  if (ci === 0) return null;
  return Math.abs(rv - pv) / Math.abs(ci);
}
