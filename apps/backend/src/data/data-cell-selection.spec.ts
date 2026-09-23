import { BadRequestException } from '@nestjs/common';
import { DataService } from './data.service';
import { Project, Experiment, ProcessData, PickedCell, EnergyEfficiency } from '../entities';

describe('Battery selection domain operations', () => {
  let service: DataService;
  let state: Map<any, any[]>;
  beforeEach(() => {
    state = new Map<any, any[]>([
      [Project, [{ id: 'project' }]],
      [Experiment, [
        { id: 'process', projectId: 'project', status: 'Draft', metadata: { assayType: 'ProcessData' } },
        { id: 'efficiency', projectId: 'project', status: 'Draft', metadata: { assayType: 'EnergyEfficiency' }, workflowStepName: 'energy_efficiency' },
      ]],
      [ProcessData, [{ id: 'a', experimentId: 'process', cellId: 'A', gqd1: '3', fq1: '2', sourceSecret: 'hidden' }, { id: 'b', experimentId: 'process', cellId: 'B', gqd1: '4' }]],
      [PickedCell, [{ id: 'pick-a', projectId: 'project', cellId: 'A', testType: 'EnergyEfficiency' }, { id: 'pick-b', projectId: 'project', cellId: 'B', testType: 'EnergyEfficiency' }]],
      [EnergyEfficiency, [{ id: 'measured', experimentId: 'efficiency', cellName: 'A', ce: '10', de: '9', ee: '0.900000' }]],
    ]);
    const matches = (row: any, where: any = {}) => Object.entries(where).every(([key, value]) =>
      value && typeof value === 'object' && 'value' in value ? (value.value as any[]).includes(row[key]) : row[key] === value);
    const getRepository = (entity: any) => ({
      find: async ({ where }: any) => structuredClone((state.get(entity) ?? []).filter(row => matches(row, where))),
      findOne: async ({ where }: any) => structuredClone((state.get(entity) ?? []).find(row => matches(row, where)) ?? null),
      create: (row: any) => row,
      save: async (value: any) => {
        const incoming = Array.isArray(value) ? value : [value];
        const rows = state.get(entity) ?? [];
        for (const row of incoming) { const index = rows.findIndex(existing => existing.id === row.id); if (index < 0) rows.push(row); else rows[index] = row; }
        state.set(entity, rows); return value;
      },
      delete: async (where: any) => state.set(entity, (state.get(entity) ?? []).filter(row => !matches(row, where))),
    });
    const source: any = { getRepository, transaction: async (work: any) => work({ getRepository }) };
    service = new DataService(source, {} as any, {} as any, { assertStepNotCompleted: async () => undefined } as any);
  });

  it('returns only the fields needed to select cells', async () => {
    const candidates = await service.findCellSelectionCandidates('project');
    expect(candidates).toHaveLength(2);
    expect(Object.keys(candidates[0]).sort()).toEqual(['cellId', 'fq1', 'fq2', 'fvg', 'gqd1', 'gr1', 'ku', 'scrapped'].sort());
  });
  it('rejects nonexistent candidates before replacing prior picks', async () => {
    await expect(service.manualPickCells('project', [{ cellId: 'other-project-cell', testType: 'EnergyEfficiency' }]))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(state.get(PickedCell)).toHaveLength(2);
  });
  it('adds missing placeholders and preserves measurements across repeated sync', async () => {
    await service.syncCellsToTables('project', 'user');
    await service.syncCellsToTables('project', 'user');
    const rows = state.get(EnergyEfficiency)!;
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.id === 'measured')).toMatchObject({ cellName: 'A', ce: '10', de: '9', ee: '0.900000' });
    expect(rows.filter(row => row.cellName === 'B')).toHaveLength(1);
  });
});
