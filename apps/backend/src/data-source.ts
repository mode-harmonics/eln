import 'reflect-metadata';
import { loadEnv } from './load-env';
loadEnv();
import { DataSource, DataSourceOptions } from 'typeorm';
import * as entities from './entities';

const entityList = Object.values(entities);

const dbUrl = process.env.DATABASE_URL;

/**
 * Migration glob — relative to __dirname so it works in both dev
 * (src/migrations/*.ts via ts-node) and production
 * (dist/migrations/*.js via node).
 */
const migrationsGlob = __dirname + '/migrations/*{.ts,.js}';

const connectionOptions: DataSourceOptions = dbUrl
  ? {
    type: 'postgres',
    url: dbUrl,
    entities: entityList,
    migrations: [migrationsGlob],
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
    migrations: [migrationsGlob],
    synchronize: false,
  };

/**
 * Standalone DataSource used only by the TypeORM CLI:
 *   pnpm --filter @eln/backend run typeorm:generate
 *   pnpm --filter @eln/backend run typeorm:run
 * Also imported by src/seed.ts to populate initial data.
 */
export const AppDataSource = new DataSource(connectionOptions);
