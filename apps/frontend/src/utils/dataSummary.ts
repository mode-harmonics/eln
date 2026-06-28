import { ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle } from '../types';

export interface SummaryDataProps {
  processData: ProcessData[];
  calendarLife: CalendarLife[];
  storageSwelling: StorageSwelling[];
  energyEfficiency: EnergyEfficiency[];
  dcrTest: DcrTest[];
  fastCharge: FastCharge[];
  htCycle: HtCycle[];
  loadedTypes?: string[];
}

export function getGroupName(
  cellName: string,
  strategy: 'prefix' | 'none' | 'custom' = 'prefix',
  customMapping: Record<string, string> = {}
): string {
  if (strategy === 'custom') return customMapping[cellName] || cellName;
  if (strategy === 'none') return cellName;
  if (cellName.includes('-')) return cellName.split('-')[0];
  if (cellName.includes('_')) return cellName.split('_')[0];
  const match = cellName.match(/^([a-zA-Z\u4e00-\u9fa5]+)\d*$/);
  if (match) return match[1];
  return 'Others';
}

export interface RawDataPoint {
  cellName: string;
  value: number;
  isOutlier: boolean;
}

export interface MetricStat {
  rawMean: number;
  outlierCell?: string;
  finalMean: number;
  sd: number;
  min: number;
  max: number;
  cov: number;
  count: number;
  rawData: RawDataPoint[];
}

export function calculateCFR21(data: { cellName: string; value: number }[]): MetricStat | null {
  if (!data || data.length === 0) return null;
  
  const rawMean = data.reduce((sum, d) => sum + d.value, 0) / data.length;
  
  let kept = [...data];
  let outlierCell: string | undefined = undefined;
  let rawData: RawDataPoint[] = data.map(d => ({ ...d, isOutlier: false }));
  
  if (data.length > 1) {
    let maxDev = -1;
    let outlierIdx = -1;
    data.forEach((d, idx) => {
      const dev = Math.abs(d.value - rawMean);
      if (dev > maxDev) {
        maxDev = dev;
        outlierIdx = idx;
      }
    });
    
    outlierCell = data[outlierIdx].cellName;
    kept = data.filter((_, idx) => idx !== outlierIdx);
    rawData[outlierIdx].isOutlier = true;
  }
  
  const finalMean = kept.reduce((sum, d) => sum + d.value, 0) / kept.length;
  const variance = kept.reduce((sum, d) => sum + Math.pow(d.value - finalMean, 2), 0) / (kept.length > 1 ? kept.length - 1 : 1);
  const sd = Math.sqrt(variance);
  const min = Math.min(...kept.map(d => d.value));
  const max = Math.max(...kept.map(d => d.value));
  const cov = finalMean !== 0 ? (sd / finalMean) * 100 : 0;
  
  return {
    rawMean,
    outlierCell,
    finalMean,
    sd,
    min,
    max,
    cov,
    count: kept.length,
    rawData
  };
}

export function calculateRelativeDeviation(targetMean: number, baseMean: number): number {
  if (baseMean === 0) return 0;
  return ((targetMean - baseMean) / baseMean) * 100;
}
