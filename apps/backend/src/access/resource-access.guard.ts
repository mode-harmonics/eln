import { applyDecorators, BadRequestException, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessMode, AccessService } from './access.service';

type Resource = 'project' | 'experiment' | 'attachment' | 'dataRow' | 'dataBatch' | 'step' | 'projectAll';
interface Rule { resource: Resource; param: string; mode: AccessMode; step?: string; body?: boolean }
const KEY = 'eln:resource-access';
export const ResourceAccess = (resource: Resource, param = 'id', mode: AccessMode = 'read', options: { step?: string; body?: boolean } = {}) =>
  applyDecorators(SetMetadata(KEY, { resource, param, mode, ...options } satisfies Rule), UseGuards(ResourceAccessGuard));

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly access: AccessService) {}
  async canActivate(context: ExecutionContext) {
    const rule = this.reflector.getAllAndOverride<Rule>(KEY, [context.getHandler(), context.getClass()]);
    if (!rule) return true;
    const req = context.switchToHttp().getRequest();
    const id = rule.body ? req.body?.[rule.param] : req.params?.[rule.param];
    switch (rule.resource) {
      case 'project': await this.access.assertProject(id, req.user, rule.mode); break;
      case 'experiment': await this.access.assertExperiment(id, req.user, rule.mode); break;
      case 'attachment': await this.access.assertAttachment(id, req.params.attachmentId, req.user, rule.mode); break;
      case 'dataRow': await this.access.assertDataRows(req.params.type, [id], req.user); break;
      case 'dataBatch':
        if (!Array.isArray(req.body?.rows)) throw new BadRequestException('Rows must be an array.');
        await this.access.assertDataRows(req.params.type, req.body.rows.map((r: any) => r?.id), req.user); break;
      case 'step': await this.access.assertStep(id, rule.step ?? req.params.stepName, req.user, rule.mode); break;
      case 'projectAll':
        if (rule.mode === 'owner') await this.access.assertProject(id, req.user, 'owner');
        await this.access.assertAllProjectExperiments(id, req.user, rule.mode === 'read' ? 'read' : 'write'); break;
    }
    return true;
  }
}
