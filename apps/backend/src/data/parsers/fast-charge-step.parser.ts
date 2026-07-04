import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { RawStepData } from '../../entities/raw-step-data.entity';
import { FastCharge, FastChargeStep } from '../../entities/fast-charge.entity';
import { DataParser } from './parser.interface';
import { computeFastChargeTime } from './fast-charge.parser';
import { isStepSheet, readStepSheet } from './step-parser.shared';

/**
 * FastChargeStepParser �?读取机器导出的「工步层」step sheet�?
 * 提取快充梯度工步，汇总为 FastCharge 业务行�?
 *
 * 提取规则:
 *   C0  = stepNo=4 容量（第一次充电容量，Ah�?
 *   stepNo >= 8 的每个恒流充电步�?
 *     cutOffVoltage  = 结束电压(V)
 *     current        = |结束电流(A)|
 *     stepCapacity   = 容量(Ah)
 *     stepTime       = 工步时间 (hh:mm:ss �?min)
 *     rate           = current / c0
 *     stepSoc        = stepCapacity / c0
 *     cumulativeSoc  = running sum of stepSoc
 *
 * 计算字段:
 *   computedFastChargeTime = t(80%SOC) - t(10%SOC) (via interpolation)
 */
export class FastChargeStepParser implements DataParser<FastCharge> {
  readonly tableName = 'fastCharge';
  rawSteps: RawStepData[] | null = null;

  getRawSteps(): RawStepData[] { return this.rawSteps ?? []; }

  detect(sheet: Worksheet, assayType?: string): boolean {
    if (assayType && assayType !== 'FastCharge') return false;
    return isStepSheet(sheet);
  }

  parse(sheet: Worksheet, experimentId: string): FastCharge[] {
    const { steps, byCell } = readStepSheet(sheet, experimentId);
    this.rawSteps = steps;

    const result: FastCharge[] = [];

    for (const [cellName, cellSteps] of byCell) {
      cellSteps.sort((a, b) => a.stepSeqNo - b.stepSeqNo);

      // C0 = 工步�? 容量（第一次充电容量）
      let c0: number | null = null;
      const chargeSteps: FastChargeStep[] = [];
      let stepCounter = 0;

      for (const s of cellSteps) {
        // 工步�? �?C0
        if (s.stepNo === 4 && s.stepType.includes('充电') && s.capacity != null) {
          c0 = Number(s.capacity);
        }

        // 工步�?>= 8 且是恒流充电 �?fast charge step
        if (s.stepNo >= 8 && s.stepType.includes('充电') && s.capacity != null) {
          stepCounter++;
          const cap = Number(s.capacity);
          const endV = s.endVoltage != null ? Number(s.endVoltage) : null;
          const endI = s.endCurrent != null ? Math.abs(Number(s.endCurrent)) : null;
          const timeMin = s.stepTime != null ? hmsToMinutes(s.stepTime) : null;
          const rate = (endI != null && c0 != null && c0 !== 0) ? endI / c0 : null;
          const stepSoc = (c0 != null && c0 !== 0) ? cap / c0 : null;

          chargeSteps.push({
            stepNo: stepCounter,
            rate: rate != null ? rate.toFixed(2) : null,
            cutOffVoltage: endV,
            current: endI,
            stepCapacity: cap,
            stepTime: timeMin,
            stepSoc,
            cumulativeSoc: null, // filled below
          });
        }
      }

      if (chargeSteps.length === 0) continue;

      // Compute cumulative SOC
      let cumSoc = 0;
      for (const cs of chargeSteps) {
        if (cs.stepSoc != null) {
          cumSoc += cs.stepSoc;
          cs.cumulativeSoc = cumSoc;
        }
      }

      // Compute 10%-80% SOC time
      const compTime = c0 != null && c0 > 0
        ? computeFastChargeTime(c0, chargeSteps)
        : null;

      result.push({
        id: uuid(),
        experimentId,
        cellName,
        c0: c0 != null ? c0.toFixed(6) : null,
        steps: chargeSteps,
        providedFastChargeTime: null,
        computedFastChargeTime: compTime != null ? compTime.toFixed(6) : null,
        createdAt: new Date(),
      } as FastCharge);
    }

    return result;
  }
}

/** Convert hh:mm:ss or hh.mm.ss string to decimal minutes. */
function hmsToMinutes(hms: string): number {
  // Handle both colon and period separators
  const parts = hms.split(/[:.]/);
  if (parts.length === 3) {
    return Number(parts[0]) * 60 + Number(parts[1]) + Number(parts[2]) / 60;
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  return Number(hms) || 0;
}
