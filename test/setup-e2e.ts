import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Jest globalSetup for e2e runs: point Prisma at a throwaway SQLite file and
 * rebuild it from the schema, so every run starts from an empty database.
 */
module.exports = (): void => {
  const dataDir = join(__dirname, '..', 'data');
  const dbFile = join(dataDir, 'test.db');

  mkdirSync(dataDir, { recursive: true });
  // Deleting the file is the reset: `db push` then creates it from scratch,
  // so no destructive --force-reset is needed.
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(`${dbFile}${suffix}`, { force: true });
  }

  // Prisma resolves relative file: URLs from the schema's directory (prisma/).
  process.env.DATABASE_URL = 'file:../data/test.db';

  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: process.env,
  });
};
