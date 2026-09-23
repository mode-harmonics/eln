import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from '../src/lib/api';
import { completeWorkflowStep, mergeInstanceStepMeta } from '../src/lib/workflow';

async function withWorkflow(steps: unknown[], run: (writes: unknown[][]) => Promise<void>) {
  const originalGet = api.get;
  const originalPut = api.put;
  const writes: unknown[][] = [];
  api.get = (async () => ({ steps })) as typeof api.get;
  api.put = (async (...args: unknown[]) => { writes.push(args); }) as typeof api.put;
  try { await run(writes); } finally { api.get = originalGet; api.put = originalPut; }
}

test('retrying a completed target does not advance the next step', async () => {
  await withWorkflow([
    { stepName: 'design', status: 'completed' },
    { stepName: 'procurement', status: 'in_progress' },
  ], async (writes) => {
    await completeWorkflowStep('project', 'design');
    assert.deepEqual(writes, []);
  });
});

test('custom template target uses its actual leaf name as the server precondition', async () => {
  await withWorkflow([{ stepName: 'custom-selection', builtInStep: 'battery_selection', status: 'in_progress' }], async (writes) => {
    await completeWorkflowStep('project', 'battery_selection');
    assert.deepEqual(writes, [['/api/v1/workflow/instances/project/transition', { expectedStepName: 'custom-selection' }]]);
  });
});

test('a missing or pending target does not mutate a different current step', async () => {
  await withWorkflow([{ stepName: 'design', status: 'pending' }], async (writes) => {
    await assert.rejects(completeWorkflowStep('project', 'design'));
    await assert.rejects(completeWorkflowStep('project', 'battery_selection'));
    assert.deepEqual(writes, []);
  });
});

test('server transition failure reaches the caller rather than becoming success', async () => {
  await withWorkflow([{ stepName: 'design', status: 'in_progress' }], async () => {
    api.put = async () => { throw new Error('conflict'); };
    await assert.rejects(completeWorkflowStep('project', 'design'), /conflict/);
  });
});

test('legacy design leaf is supported but a modern parent group cannot be advanced', async () => {
  await withWorkflow([{ stepName: 'legacy-design', builtInStep: 'experiment_design', isParallelGroup: false, status: 'in_progress' }], async (writes) => {
    await completeWorkflowStep('project', 'design');
    assert.deepEqual(writes, [['/api/v1/workflow/instances/project/transition', { expectedStepName: 'legacy-design' }]]);
  });
  await withWorkflow([{ stepName: 'experiment_design', isParallelGroup: true, status: 'in_progress' }], async (writes) => {
    await assert.rejects(completeWorkflowStep('project', 'design'));
    assert.deepEqual(writes, []);
  });
});

test('instance step semantics override defaults without guessing unmapped custom steps', () => {
  const defaults = { 'custom-pick': { label: 'Custom', builtInStep: 'formation' } };
  const result = mergeInstanceStepMeta(defaults, [
    { stepName: 'custom-pick', builtInStep: 'battery_selection' },
    { stepName: 'custom-design', builtInStep: 'design' },
    { stepName: 'unknown', builtInStep: null },
  ], (stepName) => ({ label: stepName, builtInStep: '' }));
  assert.equal(result['custom-pick'].builtInStep, 'battery_selection');
  assert.equal(result['custom-design'].builtInStep, 'design');
  assert.equal(result.unknown, undefined);
  assert.equal(defaults['custom-pick'].builtInStep, 'formation');
});
