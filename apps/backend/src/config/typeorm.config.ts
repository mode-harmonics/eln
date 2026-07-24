import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import * as entities from '../entities';
import { AppConfig } from './configuration';

const entityList = Object.values(entities);

/**
 * Runtime TypeORM config for AppModule (TypeOrmModule.forRootAsync).
 * `synchronize` is ALWAYS false — migrations are the source of truth.
 * See data-source.ts for the standalone CLI DataSource used to generate
 * and run migrations.
 */
@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const db = this.configService.get<AppConfig['database']>('database')!;

    const base = db.url
      ? { url: db.url }
      : {
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
        };

    return {
      type: 'postgres',
      ...base,
      entities: entityList,
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: false,
      migrationsRun: false,
      retryAttempts: 100,
      retryDelay: 3000,
      logging: this.configService.get<string>('nodeEnv') === 'development',
    };
  }
}
