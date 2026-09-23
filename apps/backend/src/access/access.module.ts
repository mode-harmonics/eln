import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { ResourceAccessGuard } from './resource-access.guard';

@Global()
@Module({ providers: [AccessService, ResourceAccessGuard], exports: [AccessService, ResourceAccessGuard] })
export class AccessModule {}
