import { computeDcrOhm } from '../step-parser.shared';
import { parseCalendarLifeFilename } from '../calendar-life-step.parser';

describe('calendar-life step parser helpers', () => {
  it('extracts the cell name and day from a calendar-life filename', () => {
    expect(parseCalendarLifeFilename('A001-7.xlsx')).toEqual({ cellName: 'A001', dayCount: 7 });
    expect(parseCalendarLifeFilename('测试-A001-14.xlsx')).toEqual({ cellName: '测试-A001', dayCount: 14 });
  });

  it('rejects a filename without a trailing day number', () => {
    expect(parseCalendarLifeFilename('A001.xlsx')).toBeNull();
  });

  it('computes DCR in ohms', () => {
    expect(computeDcrOhm('4.0', '3.9', '2')).toBeCloseTo(0.05);
    expect(computeDcrOhm('4.0', '3.9', '0')).toBeNull();
  });
});
