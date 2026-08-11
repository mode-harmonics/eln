import { Workbook } from 'exceljs';
import { HtCycleStepParser, normalizeImportedHtCycle } from '../ht-cycle-step.parser';

describe('high-temperature cycle import normalization', () => {
  it('discards original cycles below 7 and renumbers the rest from 1', () => {
    expect(normalizeImportedHtCycle(6)).toBeNull();
    expect(normalizeImportedHtCycle(7)).toBe(1);
    expect(normalizeImportedHtCycle(8)).toBe(2);
  });

  it('uses normalized cycles for business rows, raw rows, and retention baseline', () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Cycle');
    sheet.addRow(['Cycle', 'Capacity', 'CellName']);
    sheet.addRow([6, 12, 'A001']);
    sheet.addRow([7, 10, 'A001']);
    sheet.addRow([8, 8, 'A001']);

    const parser = new HtCycleStepParser();
    const rows = parser.parse(sheet, 'experiment-id');

    expect(rows.map((row) => row.cycle)).toEqual([1, 2]);
    expect(parser.getRawSteps().map((row) => row.cycleNo)).toEqual([1, 2]);
    expect(rows.map((row) => row.capacityRetention)).toEqual(['100.000000', '80.000000']);
  });
});
