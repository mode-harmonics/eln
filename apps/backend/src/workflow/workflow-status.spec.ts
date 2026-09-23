import { StepStatus, WorkflowStatus } from '@eln/shared';
import { isTerminalStepStatus, WorkflowService } from './workflow.service';

describe('isTerminalStepStatus', () => {
  it.each([StepStatus.Completed, StepStatus.Skipped])('treats %s as terminal', (status) => {
    expect(isTerminalStepStatus(status)).toBe(true);
  });

  it.each([StepStatus.Pending, StepStatus.InProgress])('treats %s as non-terminal', (status) => {
    expect(isTerminalStepStatus(status)).toBe(false);
  });
});

describe('testing group with no matching selected cell type', () => {
  it('finishes the empty group and completes the workflow', async () => {
    const save = jest.fn(async (value) => value);
    const update = jest.fn();
    const pickedCells = [{ testType: 'HtCycle' }];
    const source = { getRepository: () => ({ find: async () => pickedCells }) };
    const service = new WorkflowService({} as any, { save } as any, { save } as any,
      { update } as any, {} as any, {} as any, {} as any, source as any);
    const instance = { projectId: 'project', status: WorkflowStatus.Active, currentStepIndex: 0 };
    const steps = [
      { stepName: 'battery_selection', stepIndex: 0, status: StepStatus.Completed, isParallelGroup: false, parentStepName: null },
      { stepName: 'testing', builtInStep: 'testing', stepIndex: 1, status: StepStatus.Pending, isParallelGroup: true, groupType: 'parallel', parentStepName: null },
      { stepName: 'dcr_test', builtInStep: 'dcr_test', stepIndex: 2, status: StepStatus.Pending, isParallelGroup: false, parentStepName: 'testing' },
    ];
    (service as any).reloadSteps = async () => steps;

    await (service as any).advance(instance, steps, null);

    expect(steps[1].status).toBe(StepStatus.Completed);
    expect(steps[2].status).toBe(StepStatus.Skipped);
    expect(instance.status).toBe(WorkflowStatus.Completed);
    expect(update).toHaveBeenCalledWith('project', { workflowStatus: WorkflowStatus.Completed });
  });
});
