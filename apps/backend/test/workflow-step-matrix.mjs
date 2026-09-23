/** Real HTTP workflow lifecycle against a disposable, migrated and seeded database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.ELN_REVIEW_URL || 'http://127.0.0.1:3000';
if (process.env.ELN_REVIEW_ALLOW_WRITES !== 'yes' || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Requires ELN_REVIEW_ALLOW_WRITES=yes and a disposable localhost server.');
}

let token;
async function request(method, path, body) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json();
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return json?.success === true ? json.data : json;
}

const login = await request('POST', '/auth/login', {
  username: 'pi', password: process.env.ELN_REVIEW_PASSWORD || 'Password123!',
});
token = login.accessToken;
const userId = login.user.id;
const [template] = (await request('GET', '/workflow/templates?isDefault=true')).filter((item) => item.isDefault);
assert.ok(template, 'Seeded default template is required');

async function createProject() {
  return request('POST', '/projects', { name: `workflow-matrix-${randomUUID()}` });
}
async function createInstance(projectId, templateId, nodeIds) {
  return request('POST', '/workflow/instances', {
    projectId, templateId,
    assignments: nodeIds.map((stepName) => ({ stepName, assignedUserIds: [userId] })),
  });
}
async function workflow(projectId) {
  return request('GET', `/workflow/instances/${projectId}`);
}

const project = await createProject();
await createInstance(project.id, template.id, template.steps.nodes.map((node) => node.id));
const expectedLeaves = new Set((await workflow(project.id)).steps.filter((step) => !step.isParallelGroup).map((step) => step.stepName));
const completedLeaves = [];
for (let attempt = 0; attempt < expectedLeaves.size + 2; attempt++) {
  const current = await workflow(project.id);
  if (current.instance.status === 'Completed') break;
  const active = current.steps.find((step) => step.status === 'in_progress' && !step.isParallelGroup);
  assert.ok(active, `Workflow stalled after: ${completedLeaves.join(', ')}`);
  await request('PUT', `/workflow/instances/${project.id}/transition`, { expectedStepName: active.stepName });
  completedLeaves.push(active.stepName);
}
const finished = await workflow(project.id);
assert.equal(finished.instance.status, 'Completed');
assert.deepEqual(new Set(completedLeaves), expectedLeaves);
console.log(`Default workflow: ${completedLeaves.length}/${expectedLeaves.size} leaf steps completed through real HTTP`);

const expectedAssays = {
  solution_preparation: ['SolutionPreparation', 'solution'],
  drying_injection: ['ProcessData', 'process'],
  formation: ['ProcessData', 'process'],
  second_sealing: ['ProcessData', 'process'],
  capacity_grading: ['ProcessData', 'process'],
  calendar_life: ['CalendarLife', 'calendar'],
  storage_swelling: ['StorageSwelling', 'swelling'],
  energy_efficiency: ['EnergyEfficiency', 'efficiency'],
  dcr_test: ['DcrTest', 'dcr'],
  fast_charge: ['FastCharge', 'fastcharge'],
  ht_cycle: ['HtCycle', 'htcycle'],
};
const defaultExperiments = await request('GET', `/projects/${project.id}/experiments`);
for (const [stepName, [assayType, apiType]] of Object.entries(expectedAssays)) {
  const experiment = defaultExperiments.find((item) => item.workflowStepName === stepName);
  assert.equal(experiment?.metadata?.assayType, assayType, `${stepName} experiment assay`);
  assert.ok(Array.isArray(await request('GET', `/data/${apiType}/${experiment.id}`)), `${stepName} data route`);
}
console.log(`${Object.keys(expectedAssays).length} data steps have readable experiment and data routes`);

const customTemplate = await request('POST', '/workflow/templates', {
  name: `custom-formation-${randomUUID()}`,
  steps: { nodes: [{ id: 'custom_formation', label: 'Custom formation', builtInStep: 'formation' }], edges: [] },
});
const customProject = await createProject();
await createInstance(customProject.id, customTemplate.id, ['custom_formation']);
const experiments = await request('GET', `/projects/${customProject.id}/experiments`);
const customExperiment = experiments.find((item) => item.workflowStepName === 'custom_formation');
assert.ok(customExperiment?.metadata?.assayType === 'ProcessData',
  'Custom built-in formation step must have a routed ProcessData experiment when activated');
assert.ok(Array.isArray(await request('GET', `/data/process/${customExperiment.id}`)));
console.log('Custom built-in step: active experiment route exists');
