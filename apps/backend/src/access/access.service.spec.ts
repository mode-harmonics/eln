import { AccessService } from './access.service';
import { Project } from '../entities/project.entity';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { DataSource } from 'typeorm';
import { Attachment } from '../entities/attachment.entity';
import { ProcessData } from '../entities/process-data.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';

const pid = '11111111-1111-4111-8111-111111111111';
const eid = '22222222-2222-4222-8222-222222222222';
const user = (id: string, permissions = ['experiments:read', 'experiments:write', 'workflow_step:*']): RequestUser => ({ id, username: id, email: null, roleId: null, permissionList: permissions });
describe('AccessService object boundaries', () => {
  let service: AccessService;
  let records: Map<any, any[]>;
  beforeEach(() => {
    records = new Map<any, any[]>([
      [Project, [{ id: pid, createdBy: 'owner' }]],
      [Experiment, [{ id: eid, projectId: pid, workflowStepName: 'mix', reviewerId: 'reviewer' }]],
      [ExperimentCollaborator, []],
      [WorkflowInstance, [{ id: 'workflow', projectId: pid }]],
      [WorkflowStepAssignment, [{ workflowInstanceId: 'workflow', stepName: 'mix', assignedUserIds: ['assignee'], visibleToUserIds: ['viewer'] }, { workflowInstanceId: 'workflow', stepName: 'test', assignedUserIds: ['observer'], canViewOtherSteps: true }]],
    ]);
    service = new AccessService({ getRepository: (entity: any) => ({ find: async () => records.get(entity) ?? [], findOne: async ({ where }: any) => (records.get(entity) ?? []).find(row => Object.entries(where).every(([key, value]) => row[key] === value)) }) } as unknown as DataSource);
  });
  it('denies outsiders despite broad role permissions', async () => {
    await expect(service.assertExperiment(eid, user('outsider'))).rejects.toThrow();
    expect(await service.visibleScope(user('outsider'))).toEqual({ projectIds: [], experimentIds: [] });
  });
  it.each(['owner', 'assignee', 'viewer', 'observer', 'reviewer'])('allows intended read access for %s', async id => {
    await expect(service.assertExperiment(eid, user(id))).resolves.toBeDefined();
    expect((await service.visibleScope(user(id))).experimentIds).toContain(eid);
  });
  it.each(['viewer', 'observer', 'reviewer'])('does not turn read-only scope into mutation authority for %s', async id => {
    await expect(service.assertExperiment(eid, user(id), 'write')).rejects.toThrow();
  });
  it('keeps role step permissions mandatory even for canViewOtherSteps', async () => {
    await expect(service.assertExperiment(eid, user('observer', ['experiments:read']))).rejects.toThrow();
  });
  it('limits reviewer exception to read and review of assigned experiment', async () => {
    await expect(service.assertExperiment(eid, user('reviewer', ['experiments:read', 'experiments:approve', 'workflow_step:mix']), 'review')).resolves.toBeDefined();
    await expect(service.assertProject(pid, user('reviewer'), 'owner')).rejects.toThrow();
    records.get(Experiment)!.push({ id: '33333333-3333-4333-8333-333333333333', projectId: pid, workflowStepName: null });
    expect((await service.visibleScope(user('reviewer'))).experimentIds).toEqual([eid]);
  });
  it('rejects malformed identifiers before querying PostgreSQL', async () => {
    await expect(service.assertExperiment('not-a-uuid', user('owner'))).rejects.toMatchObject({ status: 400 });
  });
  it('does not let a Viewer collaborator inherit global write capability', async () => {
    records.get(ExperimentCollaborator)!.push({ experimentId: eid, userId: 'collab', role: 'Viewer' });
    await expect(service.assertExperiment(eid, user('collab'))).resolves.toBeDefined();
    await expect(service.assertExperiment(eid, user('collab'), 'write')).rejects.toThrow();
  });
  it('limits collaborator writes to the specific nonworkflow experiment', async () => {
    records.get(Experiment)![0].workflowStepName = null;
    records.get(Experiment)!.push({ id: '33333333-3333-4333-8333-333333333333', projectId: pid, workflowStepName: null });
    records.get(ExperimentCollaborator)!.push({ experimentId: eid, userId: 'collab', role: 'Editor' });
    await expect(service.assertExperiment(eid, user('collab'), 'write')).resolves.toBeDefined();
    await expect(service.assertExperiment('33333333-3333-4333-8333-333333333333', user('collab'), 'write')).rejects.toThrow();
  });
  it('does not bypass role step permissions for a reviewer', async () => {
    await expect(service.assertExperiment(eid, user('reviewer', ['experiments:read']), 'read')).rejects.toThrow();
  });
  it('rejects a valid attachment belonging to another parent experiment', async () => {
    const attachmentId = '44444444-4444-4444-8444-444444444444';
    records.set(Attachment, [{ id: attachmentId, experimentId: 'different-experiment' }]);
    await expect(service.assertAttachment(eid, attachmentId, user('owner'), 'read')).rejects.toMatchObject({ status: 404 });
  });
  it('rejects a mixed batch containing a row from an inaccessible project', async () => {
    const foreignProject = '55555555-5555-4555-8555-555555555555';
    const foreignExperiment = '66666666-6666-4666-8666-666666666666';
    const rowA = '77777777-7777-4777-8777-777777777777';
    const rowB = '88888888-8888-4888-8888-888888888888';
    records.get(Project)!.push({ id: foreignProject, createdBy: 'other-owner' });
    records.get(Experiment)!.push({ id: foreignExperiment, projectId: foreignProject, workflowStepName: null });
    records.set(ProcessData, [{ id: rowA, experimentId: eid }, { id: rowB, experimentId: foreignExperiment }]);
    await expect(service.assertDataRows('process', [rowA], user('owner'))).resolves.toBeUndefined();
    await expect(service.assertDataRows('process', [rowA, rowB], user('owner'))).rejects.toMatchObject({ status: 403 });
  });
  it('lets a battery-only assignee run selection without generic process or downstream write access', async () => {
    records.get(WorkflowStepAssignment)!.push({ workflowInstanceId: 'workflow', stepName: 'battery_selection', assignedUserIds: ['picker'], canViewOtherSteps: false });
    const picker = user('picker', ['experiments:read', 'experiments:write', 'workflow_step:battery_selection']);
    await expect(service.assertStep(pid, 'battery_selection', picker, 'read')).resolves.toBeUndefined();
    await expect(service.assertStep(pid, 'battery_selection', picker, 'write')).resolves.toBeUndefined();
    await expect(service.assertExperiment(eid, picker, 'write')).rejects.toThrow();
    await expect(service.assertAllProjectExperiments(pid, picker, 'write')).rejects.toThrow();
  });
  it('resolves domain step permissions and assignments through a custom workflow node', async () => {
    records.get(WorkflowInstance)![0].templateId = 'template';
    records.set(WorkflowTemplate, [{ id: 'template', steps: { nodes: [{ id: 'custom-pick', builtInStep: 'battery_selection' }] } }]);
    records.get(WorkflowStepAssignment)!.push({ workflowInstanceId: 'workflow', stepName: 'custom-pick', assignedUserIds: ['picker'] });
    await expect(service.assertStep(pid, 'battery_selection', user('picker', ['experiments:write', 'workflow_step:custom-pick']), 'write')).resolves.toBeUndefined();
    await expect(service.assertStep(pid, 'battery_selection', user('outsider'), 'write')).rejects.toThrow();
  });
  it('authorizes a design child assignee without granting procurement access to design', async () => {
    records.get(WorkflowStepAssignment)!.push(
      { workflowInstanceId: 'workflow', stepName: 'experiment_design', assignedUserIds: [] },
      { workflowInstanceId: 'workflow', stepName: 'design', assignedUserIds: ['designer'] },
      { workflowInstanceId: 'workflow', stepName: 'procurement', assignedUserIds: ['buyer'] },
    );
    await expect(service.assertStep(pid, 'design', user('designer', ['experiments:read', 'experiments:write', 'workflow_step:design']), 'write')).resolves.toBeUndefined();
    await expect(service.assertStep(pid, 'design', user('buyer'), 'read')).rejects.toThrow();
  });
  it('retains legacy standalone experiment_design assignee access', async () => {
    records.get(WorkflowInstance)![0].templateId = 'legacy-template';
    records.set(WorkflowTemplate, [{ id: 'legacy-template', steps: { nodes: [{ id: 'legacy-design', builtInStep: 'experiment_design' }] } }]);
    records.get(WorkflowStepAssignment)!.push({ workflowInstanceId: 'workflow', stepName: 'legacy-design', assignedUserIds: ['designer'] });
    await expect(service.assertStep(pid, 'design', user('designer', ['experiments:write', 'workflow_step:legacy-design']), 'write')).resolves.toBeUndefined();
  });
  it('does not grant downstream workflow writes merely because selection created the experiment', async () => {
    records.get(Experiment)![0].createdBy = 'picker';
    records.get(WorkflowStepAssignment)!.push({ workflowInstanceId: 'workflow', stepName: 'battery_selection', assignedUserIds: ['picker'] });
    await expect(service.assertExperiment(eid, user('picker'), 'write')).rejects.toThrow();
    records.get(Experiment)![0].workflowStepName = null;
    await expect(service.assertExperiment(eid, user('picker'), 'write')).resolves.toBeDefined();
  });
});
