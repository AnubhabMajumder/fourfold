import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';

// Resolves to apps/api/drizzle both from src/ (development, tests) and from dist/ (the built server).
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Opens (creating if needed) the database at `file`, or a fresh in-memory one for ':memory:', and migrates it. */
export function openDatabase(file: string) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db;
}

export type Db = ReturnType<typeof openDatabase>;
