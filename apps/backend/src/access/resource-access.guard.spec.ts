import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ResourceAccessGuard } from './resource-access.guard';
import { AccessService } from './access.service';
import { ExperimentsController } from '../experiments/experiments.controller';
import { ProjectsController } from '../projects/projects.controller';
import { DataController } from '../data/data.controller';
import { WorkflowController } from '../workflow/workflow.controller';
import { ExperimentDesignController } from '../experiment-design/experiment-design.controller';
import { ReagentProcurementController } from '../reagent-procurement/reagent-procurement.controller';

describe('ResourceAccessGuard route boundaries', () => {
  const user = { id: 'actor' };
  let access: Record<string, jest.Mock>;
  let guard: ResourceAccessGuard;
  beforeEach(() => {
    access = Object.fromEntries(['assertProject', 'assertExperiment', 'assertAttachment', 'assertDataRows', 'assertStep', 'assertAllProjectExperiments'].map(key => [key, jest.fn().mockResolvedValue(undefined)]));
    guard = new ResourceAccessGuard(new Reflector(), access as unknown as AccessService);
  });
  const context = (controller: any, method: string, params: any = {}, body: any = {}) => ({
    getClass: () => controller, getHandler: () => controller.prototype[method],
    switchToHttp: () => ({ getRequest: () => ({ user, params, body }) }),
  }) as ExecutionContext;

  it.each(['getVersions', 'getAttachments', 'getComments', 'getCollaborators'])('protects nested experiment read %s', async method => {
    access.assertExperiment.mockRejectedValue(new ForbiddenException());
    await expect(guard.canActivate(context(ExperimentsController, method, { id: 'experiment' }))).rejects.toThrow(ForbiddenException);
  });
  it('checks both parent experiment and attachment association', async () => {
    await guard.canActivate(context(ExperimentsController, 'downloadAttachment', { id: 'experiment', attachmentId: 'attachment' }));
    expect(access.assertAttachment).toHaveBeenCalledWith('experiment', 'attachment', user, 'read');
  });
  it('requires project ownership to grant collaborator access', async () => {
    await guard.canActivate(context(ProjectsController, 'updateMembers', { id: 'project' }));
    expect(access.assertProject).toHaveBeenCalledWith('project', user, 'owner');
  });
  it('requires project ownership for workflow reassignment', async () => {
    await guard.canActivate(context(WorkflowController, 'updateStepAssignment', { projectId: 'project' }));
    expect(access.assertProject).toHaveBeenCalledWith('project', user, 'owner');
  });
  it('requires ownership and existing experiment access for summary import', async () => {
    await guard.canActivate(context(DataController, 'uploadToProject', { projectId: 'project' }));
    expect(access.assertProject).toHaveBeenCalledWith('project', user, 'owner');
    expect(access.assertAllProjectExperiments).toHaveBeenCalledWith('project', user, 'write');
  });
  it('checks every submitted batch row before mutation', async () => {
    await guard.canActivate(context(DataController, 'batchUpdate', { type: 'process' }, { rows: [{ id: 'one' }, { id: 'two' }] }));
    expect(access.assertDataRows).toHaveBeenCalledWith('process', ['one', 'two'], user);
  });
  it.each(['pickCells', 'syncCells'])('authorizes %s as the battery selection domain action', async method => {
    await guard.canActivate(context(DataController, method, { projectId: 'project' }));
    expect(access.assertStep).toHaveBeenCalledWith('project', 'battery_selection', user, 'write');
    expect(access.assertAllProjectExperiments).not.toHaveBeenCalled();
  });
  it.each(['list', 'batchCreate', 'update', 'remove'])('uses the executable design leaf for %s', async method => {
    await guard.canActivate(context(ExperimentDesignController, method, { projectId: 'project' }));
    expect(access.assertStep).toHaveBeenCalledWith('project', 'design', user, method === 'list' ? 'read' : 'write');
  });
  it('rejects malformed batch shape before invoking row lookups', async () => {
    await expect(guard.canActivate(context(DataController, 'batchUpdate', { type: 'process' }, { rows: {} }))).rejects.toMatchObject({ status: 400 });
    expect(access.assertDataRows).not.toHaveBeenCalled();
  });
  it.each([
    [ProjectsController, ['findAll', 'create']],
    [ExperimentsController, []],
    [DataController, ['upload']],
    [ExperimentDesignController, []],
    [ReagentProcurementController, []],
    [WorkflowController, ['listTemplates', 'getDefaultSteps', 'getTemplate', 'createTemplate', 'updateTemplate', 'deleteTemplate', 'getMyTasks']],
  ] as [any, string[]][])('covers every object route on %p', (controller, exceptions) => {
    for (const method of Object.getOwnPropertyNames(controller.prototype)) {
      if (method === 'constructor' || exceptions.includes(method)) continue;
      expect(Reflect.getMetadata('eln:resource-access', controller.prototype[method])).toBeDefined();
    }
  });
  it('authorizes multipart experiment uploads after the body is parsed, before persistence', async () => {
    const data = { getExperiment: jest.fn(), uploadWorkbooks: jest.fn() };
    access.assertExperiment.mockRejectedValue(new ForbiddenException());
    const controller = new DataController(data as any, {} as any, access as unknown as AccessService);
    await expect(controller.upload([{ buffer: Buffer.from('test'), originalname: 'test.xlsx', mimetype: 'application/octet-stream', size: 4 }], { experimentId: 'experiment' } as any, user as any)).rejects.toThrow(ForbiddenException);
    expect(data.getExperiment).not.toHaveBeenCalled();
    expect(data.uploadWorkbooks).not.toHaveBeenCalled();
  });
});
