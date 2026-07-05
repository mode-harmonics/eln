import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { validationSchema } from './config/configuration';
import { TypeOrmConfigService } from './config/typeorm.config';
import { DatabaseModule } from './config/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ProjectsModule } from './projects/projects.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { DataModule } from './data/data.module';
import { AiModule } from './ai/ai.module';
import { InventoryModule } from './inventory/inventory.module';
import { GroupsModule } from './groups/groups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { TempFilesModule } from './temp-files/temp-files.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // env loaded explicitly via load-env.ts
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
    AuthModule,
    UsersModule,
    RolesModule,
    ProjectsModule,
    ExperimentsModule,
    DataModule,
    AiModule,
    InventoryModule,
    GroupsModule,
    NotificationsModule,
    DashboardModule,
    SearchModule,
    TempFilesModule,
  ],
  providers: [ConfigService],
})
export class AppModule { }
