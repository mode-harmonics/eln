import { ExperimentDesignService } from './experiment-design.service';
import { ExperimentDesign, ReagentProcurement, Project } from '../entities';

describe('Design and procurement creation transaction', () => {
  it('keeps both tables unchanged if procurement generation fails', async () => {
    let designs: any[] = [];
    const designRepo: any = { count: async () => designs.length, create: (row: any) => row, save: async (rows: any[]) => { designs = rows; return rows; } };
    const procurementRepo: any = { delete: async () => undefined, create: (row: any) => row, save: async () => { throw new Error('Procurement insert failure'); } };
    const projectRepo: any = { findOne: async () => ({ id: 'project', name: 'Demo' }) };
    const manager: any = {
      getRepository: (entity: any) => entity === ExperimentDesign ? designRepo : entity === ReagentProcurement ? procurementRepo : projectRepo,
      transaction: async (work: any) => {
        const previous = structuredClone(designs);
        try { return await work(manager); } catch (error) { designs = previous; throw error; }
      },
    };
    projectRepo.manager = manager;
    const service = new ExperimentDesignService(designRepo, procurementRepo, projectRepo, { assertStepNotCompleted: async () => undefined } as any);
    await expect(service.batchCreate('project', { groups: [{ group: 'A', moleculeName: 'LiPF6', chineseName: '', cas: '1' }] }))
      .rejects.toThrow('Procurement insert failure');
    expect(designs).toEqual([]);
  });
});
