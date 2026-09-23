/** End-to-end, real HTTP journey on a disposable migrated/seeded database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.ELN_REVIEW_URL || 'http://127.0.0.1:3000';
if (process.env.ELN_REVIEW_ALLOW_WRITES !== 'yes' || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Requires ELN_REVIEW_ALLOW_WRITES=yes and a disposable localhost server.');
}
const password = 'Journey123!';
const prefix = `journey-${randomUUID().slice(0, 8)}`;
const tokens = {};
const accounts = {};
let checks = 0;
function pass(label) { checks++; console.log(`PASS ${label}`); }
async function req(method, path, actor, body) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json();
  return { status: response.status, data: json?.success === true ? json.data : json };
}
async function ok(method, path, actor, body, expected = 200) {
  const result = await req(method, path, actor, body);
  assert.equal(result.status, expected, `${actor ?? 'anonymous'} ${method} ${path}: HTTP ${result.status} ${JSON.stringify(result.data).slice(0, 500)}`);
  return result.data;
}
async function denied(method, path, actor, body) {
  const result = await req(method, path, actor, body);
  assert.ok([400, 403, 404, 409].includes(result.status), `${actor} unexpectedly succeeded: ${method} ${path} HTTP ${result.status}`);
}
async function workflow(projectId, actor = 'owner') {
  return ok('GET', `/workflow/instances/${projectId}`, actor);
}
async function active(projectId, expected) {
  const wf = await workflow(projectId);
  const step = wf.steps.find((item) => item.stepName === expected);
  assert.equal(step?.status, 'in_progress', `${expected} status`);
  return wf;
}
async function finish(projectId, name, actor, wrongActor) {
  await active(projectId, name);
  const path = `/workflow/instances/${projectId}/transition`;
  if (wrongActor) {
    await denied('PUT', path, wrongActor, { expectedStepName: name });
    await active(projectId, name);
  }
  await ok('PUT', path, actor, { expectedStepName: name });
  assert.equal((await workflow(projectId)).steps.find((step) => step.stepName === name)?.status, 'completed');
  pass(`${name}: only ${actor} completes the assigned step`);
}
async function tasks(actor, projectId) {
  const list = await ok('GET', '/workflow/tasks', actor);
  return list.filter((task) => task.projectId === projectId);
}

const adminLogin = await ok('POST', '/auth/login', null, { username: 'admin', password: process.env.ELN_REVIEW_PASSWORD || 'Password123!' });
tokens.admin = adminLogin.accessToken;
const rolesResponse = await ok('GET', '/roles', 'admin');
const roles = Array.isArray(rolesResponse) ? rolesResponse : rolesResponse.items;
for (const [actor, role] of [['owner', 'Owner'], ['alice', 'Editor'], ['bob', 'Editor'], ['viewer', 'Viewer']]) {
  const roleId = roles.find((item) => item.name === role)?.id;
  assert.ok(roleId, `Missing ${role} role`);
  const username = `${prefix}-${actor}`;
  accounts[actor] = await ok('POST', '/users', 'admin', { username, fullName: `Journey ${actor}`, roleId, password }, 201);
  const login = await ok('POST', '/auth/login', null, { username, password });
  tokens[actor] = login.accessToken;
  assert.equal(login.user.id, accounts[actor].id);
}
pass('admin creates four independent accounts and all can log in');

const project = await ok('POST', '/projects', 'owner', { name: `${prefix}-project`, description: 'Multi-account workflow acceptance' }, 201);
await denied('GET', `/projects/${project.id}`, 'alice');
await denied('GET', `/projects/${project.id}`, 'viewer');
pass('new project is initially isolated from other accounts');

const templates = await ok('GET', '/workflow/templates?isDefault=true', 'owner');
const template = templates.find((item) => item.isDefault);
assert.ok(template);
const actorFor = (name) => ({
  design: 'alice', procurement: 'bob', solution_preparation: 'alice', drying_injection: 'bob',
  formation: 'alice', second_sealing: 'bob', capacity_grading: 'alice', battery_selection: 'bob',
  calendar_life: 'alice', storage_swelling: 'bob', energy_efficiency: 'alice', dcr_test: 'bob',
  fast_charge: 'alice', ht_cycle: 'bob',
})[name] ?? 'owner';
const assignments = template.steps.nodes.map((node) => ({ stepName: node.id, assignedUserIds: [accounts[actorFor(node.id)].id] }));
await ok('POST', '/workflow/instances', 'owner', { projectId: project.id, templateId: template.id, assignments }, 201);
assert.ok((await tasks('alice', project.id)).some((task) => task.stepName === 'design'));
assert.ok((await tasks('bob', project.id)).some((task) => task.stepName === 'procurement'));
await denied('GET', `/workflow/instances/${project.id}`, 'viewer');
pass('project creator assigns all template nodes; assignees receive scoped tasks');

await ok('PUT', `/workflow/instances/${project.id}/steps/design`, 'owner', { assignedUserIds: [accounts.bob.id] });
assert.equal((await tasks('alice', project.id)).some((task) => task.stepName === 'design'), false);
assert.ok((await tasks('bob', project.id)).some((task) => task.stepName === 'design'));
await denied('PUT', `/workflow/instances/${project.id}/steps/design`, 'alice', { assignedUserIds: [accounts.alice.id] });
await denied('PUT', `/workflow/instances/${project.id}/transition`, 'alice', { expectedStepName: 'design' });
pass('owner reassignment updates task ownership and former assignee loses action');

await ok('POST', `/projects/${project.id}/design`, 'bob', { groups: [{ group: 'A', moleculeName: 'Journey molecule', chineseName: '测试分子', cas: 'journey', cellCount: 6, redundancyCount: 0 }] }, 201);
await denied('GET', `/projects/${project.id}/design`, 'alice');
await finish(project.id, 'design', 'bob', 'alice');
const procurementRows = await ok('GET', `/projects/${project.id}/procurement`, 'bob');
assert.ok(procurementRows.length > 0);
await ok('PUT', `/projects/${project.id}/procurement/${procurementRows[0].id}`, 'bob', { supplier: 'Journey supplier', isValid: true });
await denied('GET', `/projects/${project.id}/procurement`, 'alice');
await finish(project.id, 'procurement', 'bob', 'alice');
pass('design generates procurement; assigned worker updates purchasing record');

const assayRoutes = {
  solution_preparation: 'solution', drying_injection: 'process', formation: 'process',
  second_sealing: 'process', capacity_grading: 'process', calendar_life: 'calendar',
  storage_swelling: 'swelling', energy_efficiency: 'efficiency', dcr_test: 'dcr',
  fast_charge: 'fastcharge', ht_cycle: 'htcycle',
};
async function experimentFor(stepName) {
  const list = await ok('GET', `/projects/${project.id}/experiments`, 'owner');
  const experiment = list.find((item) => item.workflowStepName === stepName);
  assert.ok(experiment, `${stepName} experiment missing`);
  return experiment;
}
const serial = ['solution_preparation', 'drying_injection', 'formation', 'second_sealing', 'capacity_grading'];
for (const name of serial) {
  const actor = actorFor(name);
  const experiment = await experimentFor(name);
  await ok('GET', `/experiments/${experiment.id}`, actor);
  await ok('GET', `/data/${assayRoutes[name]}/${experiment.id}`, actor);
  if (name === 'solution_preparation') {
    await ok('POST', `/data/solution/${experiment.id}`, actor, { groupName: 'A', materialName: 'Journey solvent' }, 201);
  }
  if (name === 'formation') {
    for (let index = 1; index <= 6; index++) {
      await ok('POST', `/data/process/${experiment.id}`, actor,
        { cellId: `J${index.toString().padStart(3, '0')}`, gqd1: String(index), gr1: '1' }, 201);
    }
  }
  await finish(project.id, name, actor, actor === 'alice' ? 'bob' : 'alice');
}
pass('assigned workers enter solution and process data, then complete serial lab steps');

await active(project.id, 'battery_selection');
const candidates = await ok('GET', `/data/selection-candidates/${project.id}`, 'bob');
const cells = Array.from({ length: 6 }, (_, index) => `J${(index + 1).toString().padStart(3, '0')}`);
for (const cellId of cells) assert.ok(candidates.some((item) => item.cellId === cellId), `${cellId} absent from selection`);
await denied('GET', `/data/selection-candidates/${project.id}`, 'alice');
const types = ['CalendarLife', 'StorageSwelling', 'EnergyEfficiency', 'DcrTest', 'FastCharge', 'HtCycle'];
await ok('POST', `/data/pick-cells/${project.id}`, 'bob', { mode: 'manual', assignments: cells.map((cellId, index) => ({ cellId, testType: types[index] })) }, 201);
await ok('POST', `/data/sync-cells/${project.id}`, 'bob', {}, 201);
const picked = await ok('GET', `/data/picked-cells/${project.id}`, 'bob');
assert.equal(picked.filter((item) => item.testType).length, 6);
await finish(project.id, 'battery_selection', 'bob', 'alice');
pass('selection assignee chooses six cells, syncs records, and activates six test types');

const parallel = ['calendar_life', 'storage_swelling', 'energy_efficiency', 'dcr_test', 'fast_charge', 'ht_cycle'];
let wf = await workflow(project.id);
for (const name of parallel) assert.equal(wf.steps.find((item) => item.stepName === name)?.status, 'in_progress', `${name} not activated`);
for (const name of parallel) {
  const actor = actorFor(name);
  const experiment = await experimentFor(name);
  await ok('GET', `/experiments/${experiment.id}`, actor);
  await ok('GET', `/data/${assayRoutes[name]}/${experiment.id}`, actor);
  await finish(project.id, name, actor, actor === 'alice' ? 'bob' : 'alice');
}
wf = await workflow(project.id);
assert.equal(wf.instance.status, 'Completed');
assert.equal(wf.steps.find((item) => item.stepName === 'testing')?.status, 'completed');
assert.equal((await tasks('alice', project.id)).length, 0);
assert.equal((await tasks('bob', project.id)).length, 0);
pass('all parallel tests finish and both task queues clear');

const formation = await experimentFor('formation');
await denied('POST', `/data/process/${formation.id}`, 'alice', { cellId: 'TOO-LATE' });
await ok('PUT', `/projects/${project.id}/members`, 'owner', { members: [{ userId: accounts.viewer.id, role: 'Viewer' }] });
await ok('GET', `/projects/${project.id}`, 'viewer');
await ok('GET', `/experiments/${formation.id}`, 'viewer');
await denied('PUT', `/experiments/${formation.id}`, 'viewer', { title: 'Forbidden', versionNo: formation.versionNo });
pass('completed workflow rejects new data; added viewer reads but cannot edit');

const ownerNotifications = await ok('GET', '/notifications', 'owner');
const bobNotifications = await ok('GET', '/notifications', 'bob');
assert.ok((ownerNotifications.items ?? ownerNotifications).length > 0);
assert.ok((bobNotifications.items ?? bobNotifications).length > 0);
await ok('GET', `/projects/${project.id}/stats`, 'owner');
await ok('GET', '/dashboard/summary', 'owner');
pass('notifications, project stats, and dashboard remain readable');
console.log(`RESULT ${checks}/${checks} multi-account journey checks passed`);
