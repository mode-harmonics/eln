import { ProcessDataParser } from '../process-data.parser';
import { buildWorksheet, assertDetected } from './test-helpers';

describe('ProcessDataParser', () => {
  const parser = new ProcessDataParser();

  describe('detect', () => {
    it('returns true for a sheet with batteryId + formation fields', () => {
      const ws = buildWorksheet([
        ['batteryId', 'm0',       'fu0', 'fr0', 'fq1', 'fq2', 'picked'],
        ['C001',      45.234,     3.85,  12.5,  2.15,  2.10,  '是'],
        ['C002',      45.112,     3.82,  13.1,  2.09,  2.04,  '是'],
      ]);
      assertDetected(parser, ws);
    });

    it('returns true using cellId header variant', () => {
      const ws = buildWorksheet([
        ['cellId', 'fu0', 'fr0', 'fq1', 'picked'],
        ['C001',   3.85,  12.5,  2.15,  '是'],
      ]);
      assertDetected(parser, ws);
    });

    it('returns false for an unrelated sheet', () => {
      const ws = buildWorksheet([
        ['cellName', 'q_0d', 'q_7d', 'ddcr_0d'],
        ['Cell-A',   2.0,    1.95,   18.5],
      ]);
      expect(parser.detect(ws)).toBe(false);
    });
  });

  describe('parse', () => {
    it('converts rows into Partial<ProcessData> objects', () => {
      const ws = buildWorksheet([
        ['batteryId', 'm0',       'fu0', 'fr0', 'fq1', 'fq2', 'picked'],
        ['C001',      45.234,     3.85,  12.5,  2.15,  2.10,  '是'],
        ['C002',      45.112,     3.82,  13.1,  2.09,  2.04,  ''],
      ]);
      const experimentId = 'exp-001';
      const rows = parser.parse(ws, experimentId);

      expect(rows).toHaveLength(2);

      // Row 0
      expect(rows[0]).toMatchObject({
        experimentId,
        cellId: 'C001',
        m0: '45.234',
        fu0: '3.85',
        fr0: '12.5',
        fq1: '2.15',
        fq2: '2.10',
        picked: true,
      });
      expect(rows[0]).toHaveProperty('id');

      // Row 1 (picked = false)
      expect(rows[1]).toMatchObject({
        experimentId,
        cellId: 'C002',
        m0: '45.112',
        picked: false,
      });
    });

    it('handles empty sheets gracefully', () => {
      const ws = buildWorksheet([['batteryId', 'fu0', 'fr0', 'picked']]);
      const rows = parser.parse(ws, 'exp-001');
      expect(rows).toHaveLength(0);
    });
  });
});
