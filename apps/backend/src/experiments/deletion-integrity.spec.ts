import { ConflictException } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { ProjectsService } from '../projects/projects.service';
import { Experiment, Project, ExperimentComment, ProcessData, WorkflowInstance, ExperimentDesign, VersionHistory } from '../entities';

describe('Conservative deletion integrity', () => {
  const setup = (dependent?: unknown, status = 'Draft') => {
    const manager = {
      findOne: jest.fn(async (entity) => entity === Project ? { id: 'project' } : { id: 'experiment', status }),
      getRepository: jest.fn((entity) => ({ count: jest.fn(async () => entity === dependent ? 1 : 0) })),
      delete: jest.fn(), remove: jest.fn(),
    };
    const source = { transaction: (fn: any) => fn(manager) };
    return { manager, experiments: new ExperimentsService(...([...Array(9).fill({}), source] as ConstructorParameters<typeof ExperimentsService>)),
      projects: new ProjectsService({} as any, {} as any, {} as any, source as any) };
  };
  it.each([ExperimentComment, ProcessData, VersionHistory])('preserves experiments with %p records', async (entity) => {
    const { manager, experiments } = setup(entity);
    await expect(experiments.remove('experiment')).rejects.toBeInstanceOf(ConflictException);
    expect(manager.remove).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });
  it.each(['In Review', 'Approved', 'Archived'])('preserves %s experiments', async (status) => {
    await expect(setup(undefined, status).experiments.remove('experiment')).rejects.toBeInstanceOf(ConflictException);
  });
  it('deletes only an empty draft inside the locked transaction', async () => {
    const { manager, experiments } = setup();
    await expect(experiments.remove('experiment')).resolves.toEqual({ success: true });
    expect(manager.findOne).toHaveBeenCalledWith(Experiment, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(manager.remove).toHaveBeenCalledWith(Experiment, { id: 'experiment', status: 'Draft' });
  });
  it.each([Experiment, WorkflowInstance, ExperimentDesign])('preserves projects with %p records', async (entity) => {
    const { manager, projects } = setup(entity);
    await expect(projects.remove('project')).rejects.toBeInstanceOf(ConflictException);
    expect(manager.remove).not.toHaveBeenCalled();
  });
  it('allows deletion of an empty project', async () => {
    await expect(setup().projects.remove('project')).resolves.toEqual({ deleted: true });
  });
});
