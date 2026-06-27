/**
 * DatabaseModule — provides TypeORM DataSource with non-blocking startup.
 *
 * When PostgreSQL is unavailable the app still starts:
 * - All modules initialize normally.
 * - app.listen() is called and Swagger / non-DB routes work.
 * - DB-dependent routes return 500 until the connection succeeds.
 * - Background retry loop attempts reconnect every 3 s (up to 100 times).
 *
 * This module provides the `DataSource` token directly (instead of going
 * through TypeOrmModule.forRootAsync) so that initialization never blocks
 * the NestJS bootstrap.
 */
import {
  DynamicModule,
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './typeorm.config';
import { AppConfig } from './configuration';
import * as entities from '../entities';

const entityList = Object.values(entities);

/** Exported token so feature modules can inject the DataSource. */
export const DATA_SOURCE_TOKEN = 'DATA_SOURCE';

@Global()
@Module({})
export class DatabaseModule implements OnApplicationBootstrap {
  private static readonly logger = new Logger('DatabaseModule');

  async onApplicationBootstrap() {
    // Intentionally empty — connection is started in background by the
    // custom provider's factory; we just log a friendly message here.
    DatabaseModule.logger.log('App bootstrapped. DB connection runs in background.');
  }

  /**
   * Returns a DynamicModule that provides the TypeORM DataSource
   * asynchronously WITHOUT blocking the NestJS startup sequence.
   */
  static forRootAsync(): DynamicModule {
    const dataSourceProvider = {
      provide: getDataSourceToken(),
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<DataSource> => {
        const db = configService.get<AppConfig['database']>('database')!;

        const base: Partial<DataSourceOptions> = db.url
          ? ({ url: db.url } as Partial<DataSourceOptions>)
          : {
              host: db.host,
              port: db.port,
              username: db.username,
              password: db.password,
              database: db.database,
            };

        const options: DataSourceOptions = {
          type: 'postgres',
          ...base,
          entities: entityList,
          synchronize: false,
          logging: configService.get<string>('nodeEnv') === 'development',
        } as DataSourceOptions;

        const dataSource = new DataSource(options);

        // Start connection in the background — does NOT block NestJS init.
        let attempts = 0;
        const maxAttempts = 100;
        const delay = 3000;

        const tryConnect = () => {
          if (dataSource.isInitialized) return;
          dataSource
            .initialize()
            .then(() => {
              DatabaseModule.logger.log('PostgreSQL connected successfully.');
            })
            .catch((err: Error) => {
              attempts++;
              if (attempts < maxAttempts) {
                DatabaseModule.logger.warn(
                  `Unable to connect to DB (attempt ${attempts}/${maxAttempts}). Retrying in ${delay / 1000}s...`,
                );
                setTimeout(tryConnect, delay);
              } else {
                DatabaseModule.logger.error(
                  `Failed to connect to DB after ${maxAttempts} attempts. Giving up.`,
                  err.message,
                );
              }
            });
        };

        // Fire-and-forget: start retrying immediately after the current
        // event-loop tick so NestJS can finish module initialization first.
        setImmediate(tryConnect);

        // Return the (not-yet-connected) DataSource — NestJS registers it
        // and feature modules receive it via @InjectDataSource().
        return dataSource;
      },
    };

    return {
      module: DatabaseModule,
      providers: [TypeOrmConfigService, dataSourceProvider],
      exports: [dataSourceProvider],
    };
  }
}
