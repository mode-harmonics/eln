import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplate, WorkflowInstance, WorkflowStepAssignment, Project, User } from '../entities';

describe('Workflow creation atomicity', () => {
  let service: WorkflowService;
  let state: Map<any, any[]>;
  let failAssignments: boolean;
  let ensureExperiment: jest.Mock;
  beforeEach(() => {
    failAssignments = false;
    ensureExperiment = jest.fn().mockResolvedValue(undefined);
    state = new Map<any, any[]>([
      [Project, [{ id: 'project', createdBy: 'owner' }]],
      [WorkflowTemplate, [{ id: 'template', isDefault: false, steps: { nodes: [{ id: 'design', label: 'Design' }], edges: [] } }]],
    ]);
    const repo = (entity: any): any => ({
      findOne: async ({ where }: any) => (state.get(entity) ?? []).find(row => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
      find: async () => state.get(entity) ?? [],
      create: (value: any) => value,
      count: async ({ where }: any) => (state.get(entity) ?? []).filter(row => Object.entries(where).every(([key, value]) => row[key] === value)).length,
      save: async (value: any) => {
        if (entity === WorkflowStepAssignment && failAssignments) throw new Error('Assignment insert failed');
        state.set(entity, [...(state.get(entity) ?? []), ...(Array.isArray(value) ? value : [value])]);
        return value;
      },
      update: async (id: string, values: any) => Object.assign((state.get(entity) ?? []).find(row => row.id === id) ?? {}, values),
    });
    const source: any = {
      transaction: async (work: any) => {
        const before = new Map([...state].map(([entity, rows]) => [entity, structuredClone(rows)]));
        try { return await work({ getRepository: repo }); }
        catch (error) { state = before; throw error; }
      },
    };
    service = new WorkflowService(repo(WorkflowTemplate), repo(WorkflowInstance), repo(WorkflowStepAssignment), repo(Project), repo(User), { createNotification: async () => undefined } as any, { ensureWorkflowExperiment: ensureExperiment } as any, source);
  });
  const input = { projectId: 'project', templateId: 'template', assignments: [] };
  it('rolls back a workflow instance when assignment insertion fails', async () => {
    failAssignments = true;
    await expect(service.createInstance(input)).rejects.toThrow('Assignment insert failed');
    expect(state.get(WorkflowInstance) ?? []).toEqual([]);
    expect(state.get(Project)?.[0].workflowInstanceId).toBeUndefined();
  });
  it('rejects a second workflow instance for the same project', async () => {
    state.set(WorkflowInstance, [{ id: 'existing', projectId: 'project' }]);
    await expect(service.createInstance(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(state.get(WorkflowInstance)).toHaveLength(1);
  });
  it('rejects workflow creation for a deleted project', async () => {
    state.set(Project, []);
    await expect(service.createInstance(input)).rejects.toBeInstanceOf(NotFoundException);
    expect(state.get(WorkflowInstance) ?? []).toEqual([]);
  });
  it('creates the initial experiment for a custom node mapped to a built-in assay', async () => {
    state.set(WorkflowTemplate, [{
      id: 'template', isDefault: false,
      steps: { nodes: [{ id: 'custom_formation', label: 'Custom formation', builtInStep: 'formation' }], edges: [] },
    }]);

    await service.createInstance({
      ...input,
      assignments: [{ stepName: 'custom_formation', assignedUserIds: ['owner'] }],
    });

    expect(ensureExperiment).toHaveBeenCalledWith('project', 'custom_formation', expect.any(Object), 'formation');
  });
  it('rolls back instance creation if the initial experiment cannot be created', async () => {
    state.set(WorkflowTemplate, [{
      id: 'template', isDefault: false,
      steps: { nodes: [{ id: 'formation', label: 'Formation' }], edges: [] },
    }]);
    ensureExperiment.mockRejectedValueOnce(new Error('Experiment creation failed'));

    await expect(service.createInstance(input)).rejects.toThrow('Experiment creation failed');
    expect(state.get(WorkflowInstance) ?? []).toEqual([]);
    expect(state.get(WorkflowStepAssignment) ?? []).toEqual([]);
  });
});
