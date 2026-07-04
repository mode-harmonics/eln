import { Worksheet } from 'exceljs';
import { v4 as uuid } from 'uuid';
import { RawStepData } from '../../entities/raw-step-data.entity';
import { EnergyEfficiency } from '../../entities/energy-efficiency.entity';
import { DataParser } from './parser.interface';
import { isStepSheet, readStepSheet } from './step-parser.shared';

/**
 * EnergyEfficiencyStepParser �?读取机器导出的「工步层」step sheet（能量数据版），
 * 提取第三次充放电�?DE / CE，汇总为 EnergyEfficiency 业务行�?
 *
 * 提取规则:
 *   循环�?3, 恒流放电 �?DE (放电能量)
 *   循环�?3, 恒流充电 �?CE (充电能量)
 *
 * 计算字段:
 *   ee = de / ce    能量效率�?
 */
export class EnergyEfficiencyStepParser implements DataParser<EnergyEfficiency> {
  readonly tableName = 'energyEfficiency';
  rawSteps: RawStepData[] | null = null;

  getRawSteps(): RawStepData[] { return this.rawSteps ?? []; }

  detect(sheet: Worksheet, assayType?: string): boolean {
    if (assayType && assayType !== 'EnergyEfficiency') return false;
    return isStepSheet(sheet);
  }

  parse(sheet: Worksheet, experimentId: string): EnergyEfficiency[] {
    const { steps, byCell } = readStepSheet(sheet, experimentId);
    this.rawSteps = steps;

    const result: EnergyEfficiency[] = [];

    for (const [cellName, cellSteps] of byCell) {
      cellSteps.sort((a, b) => a.stepSeqNo - b.stepSeqNo);

      let de: string | null = null;
      let ce: string | null = null;

      for (const s of cellSteps) {
        // 只取循环�?3 的数�?
        if (s.cycleNo !== 3) continue;

        if (s.stepType.includes('放电') && s.capacity != null) {
          de = s.capacity;  // capacity 字段存的是能�?Wh)
        }
        if (s.stepType.includes('充电') && s.capacity != null) {
          ce = s.capacity;
        }
      }

      if (de == null && ce == null) continue;

      const deN = de != null ? Number(de) : null;
      const ceN = ce != null ? Number(ce) : null;
      const ee  = (deN != null && ceN != null && ceN !== 0) ? deN / ceN : null;

      result.push({
        id: uuid(),
        experimentId,
        cellName,
        de,
        ce,
        ee: ee != null ? ee.toFixed(6) : null,
        createdAt: new Date(),
      } as EnergyEfficiency);
    }

    return result;
  }
}
