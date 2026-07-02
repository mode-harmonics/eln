import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Reads --env <name> from process.argv and loads env/<name>.env.
 * Falls back to "local" if not specified.
 *
 * Usage in scripts:
 *   nest start --watch -- --env local
 *   ts-node src/seed.ts -- --env test
 *   typeorm-ts-node-commonjs migration:run -d src/data-source.ts -- --env test
 */
export function loadEnv(): string {
  const idx = process.argv.indexOf('--env');
  const name = idx !== -1 ? process.argv[idx + 1] : 'local';

  const envFile = resolve(__dirname, `../env/${name}.env`);
  const result = config({ path: envFile });

  if (result.error) {
    throw new Error(`[loadEnv] Failed to load env/${name}.env: ${result.error.message}`);
  }

  return name;
}
