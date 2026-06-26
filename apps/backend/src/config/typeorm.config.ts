import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
    const db = this.configService.get<AppConfig['db']>('app.db')!;

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
      logging: this.configService.get<string>('app.nodeEnv') === 'development',
    };
  }
}

/**
 * Dev-convenience helper: spins up a one-off DataSource with
 * synchronize=true to rapid-prototype schema changes. NEVER use in
 * production — migrations remain the only source of truth there.
 * Invoked via `pnpm --filter @eln/backend run typeorm:sync`.
 */
export async function syncSchemaForDevOnly(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run synchronize:true sync in production.');
  }

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'eln',
    password: process.env.DB_PASSWORD ?? 'eln',
    database: process.env.DB_NAME ?? 'eln',
    entities: entityList,
    synchronize: true,
    logging: true,
  });

  await ds.initialize();
  // eslint-disable-next-line no-console
  console.log('Dev schema sync complete (synchronize:true). Destroying connection.');
  await ds.destroy();
}