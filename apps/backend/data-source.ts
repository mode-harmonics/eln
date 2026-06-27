import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as entities from './src/entities';

config(); // load apps/backend/.env

const entityList = Object.values(entities);

const dbUrl = process.env.DATABASE_URL;

const connectionOptions: DataSourceOptions = dbUrl
  ? {
      type: 'postgres',
      url: dbUrl,
      entities: entityList,
      migrations: ['src/migrations/*{.ts,.js}'],
      synchronize: false,
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'eln',
      password: process.env.DB_PASSWORD ?? 'eln',
      database: process.env.DB_NAME ?? 'eln',
      entities: entityList,
      migrations: ['src/migrations/*{.ts,.js}'],
      synchronize: false,
    };

/**
 * Standalone DataSource used only by the TypeORM CLI:
 *   pnpm --filter @eln/backend run typeorm:generate
 *   pnpm --filter @eln/backend run typeorm:run
 * Also imported by src/seed.ts to populate initial data.
 */
export const AppDataSource = new DataSource(connectionOptions);