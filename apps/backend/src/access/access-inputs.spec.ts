import { ValidationPipe } from '@nestjs/common';
import { AddCollaboratorDto, AddExperimentCommentDto } from '../experiments/dto/collaborator-comment.dto';
import { CreateWorkflowInstanceDto, UpdateStepAssignmentDto } from '../workflow/dto/workflow.dto';

describe('access input boundaries', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const check = (metatype: any, value: any) => pipe.transform(value, { type: 'body', metatype });
  it('rejects invalid collaborator IDs and roles', async () => {
    await expect(check(AddCollaboratorDto, { userId: 'bad', role: 'Editor' })).rejects.toThrow();
    await expect(check(AddCollaboratorDto, { userId: '11111111-1111-4111-8111-111111111111', role: 'arbitrary' })).rejects.toThrow();
  });
  it.each([123, null, '   '])('rejects malformed comment %s', async content => {
    await expect(check(AddExperimentCommentDto, { content })).rejects.toThrow();
  });
  it('rejects malformed workflow user IDs and project IDs before services run', async () => {
    await expect(check(UpdateStepAssignmentDto, { assignedUserIds: ['bad'] })).rejects.toThrow();
    await expect(check(CreateWorkflowInstanceDto, { projectId: 'bad', assignments: [] })).rejects.toThrow();
  });
});
