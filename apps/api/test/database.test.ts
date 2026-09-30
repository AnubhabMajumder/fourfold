import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db.ts';
import { matrices } from '../src/schema.ts';
import { setup } from './harness.ts';

describe('the database file', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const tempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'fourfold-test-'));
    dirs.push(dir);
    return dir;
  };

  it('is created, with its directory, and migrated when it does not exist yet', async () => {
    const file = join(tempDir(), 'nested', 'fourfold.db');
    const db = openDatabase(file);
    const tables = db.$client.prepare("select name from sqlite_master where type = 'table'").pluck().all();
    expect(tables).toEqual(expect.arrayContaining(['tasks', 'matrices']));
    db.$client.close();
  });

  it('keeps Tasks across a restart, applying migrations again without harm', async () => {
    const file = join(tempDir(), 'fourfold.db');
    const first = openDatabase(file);
    await setup(undefined, first).writeAll('Buy milk', 'Call Mum');
    first.$client.close();

    const second = openDatabase(file);
    expect(await setup(undefined, second).taskListTexts()).toEqual(['Call Mum', 'Buy milk']);
    second.$client.close();
  });

  it('refuses to delete a Matrix while any Task belongs to it', async () => {
    const db = openDatabase(':memory:');
    const api = setup(undefined, db);
    const [milk] = await api.writeAll('Buy milk');
    await api.place(milk!, '2026-09-24', 'important-urgent');
    expect(() => db.delete(matrices).run()).toThrow(/FOREIGN KEY/);
    expect(await api.quadrantTexts('2026-09-24', 'important-urgent')).toEqual(['Buy milk']);
  });
});
