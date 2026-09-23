import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplate } from '../entities/workflow-template.entity';

describe('WorkflowService template deletion', () => {
  let service: WorkflowService;
  let templates: WorkflowTemplate[];
  let instances: Array<{ templateId: string; status: string }>;

  beforeEach(() => {
    templates = [{
      id: 'template-used', name: 'Custom template', description: null,
      isDefault: false, steps: { nodes: [], edges: [] },
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    } as WorkflowTemplate];
    instances = [];
    // Replace only database I/O; exercise the real deletion policy and lookup.
    const templateRepo = {
      findOne: async ({ where }: { where: { id: string } }) =>
        templates.find((template) => template.id === where.id) ?? null,
      remove: async (template: WorkflowTemplate) => {
        templates = templates.filter((item) => item.id !== template.id);
        return template;
      },
      save: async (template: WorkflowTemplate) => template,
    };
    const instanceRepo = {
      count: async ({ where }: { where: { templateId: string } }) =>
        instances.filter((instance) => instance.templateId === where.templateId).length,
    };
    service = new WorkflowService(
      templateRepo as any, instanceRepo as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {
        transaction: async (work: any) => work({ getRepository: (entity: any) => entity === WorkflowTemplate ? templateRepo : instanceRepo }),
      } as any,
    );
  });

  it.each(['Active', 'Completed', 'Paused'])('keeps templates referenced by %s workflows', async (status) => {
    instances.push({ templateId: 'template-used', status });

    await expect(service.removeTemplate('template-used')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.findTemplateById('template-used')).resolves.toMatchObject({ id: 'template-used' });
  });

  it('removes an unused custom template even when other templates have instances', async () => {
    instances.push({ templateId: 'other-template', status: 'Active' });

    await expect(service.removeTemplate('template-used')).resolves.toBeUndefined();
    await expect(service.findTemplateById('template-used')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps an unused default template', async () => {
    templates[0].isDefault = true;

    await expect(service.removeTemplate('template-used')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.findTemplateById('template-used')).resolves.toMatchObject({ isDefault: true });
  });

  it('returns not found for a missing template', async () => {
    await expect(service.removeTemplate('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects changing the graph of an in-use template', async () => {
    instances.push({ templateId: 'template-used', status: 'Active' });
    await expect(service.updateTemplate('template-used', { steps: { nodes: [{ id: 'replacement' }], edges: [] } }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
