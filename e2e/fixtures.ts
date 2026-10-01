// Runs the real, built Fourfold server for each test, against a temporary database and a clock that starts at
// the test's chosen local time. The browser's clock is pinned to the same time.
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { createClient } from '@fourfold/core';

/** Not the fixed port in core, so the tests never clash with a Fourfold already running; FOURFOLD_TEST_PORT lets parallel checkouts each use their own. */
const TEST_PORT = Number(process.env.FOURFOLD_TEST_PORT ?? 4799);
export const BASE_URL = `http://localhost:${TEST_PORT}`;

class Server {
  private proc: ChildProcess | undefined;
  private readonly dir = mkdtempSync(join(tmpdir(), 'fourfold-e2e-'));
  private readonly startedAt = Date.now();
  private readonly start: Date;

  constructor(start: Date) {
    this.start = start;
  }

  /** Starts (or restarts) the server; its clock carries on from where the test's time has got to. */
  async run() {
    const now = new Date(this.start.getTime() + (Date.now() - this.startedAt));
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 23);
    this.proc = spawn(process.execPath, ['apps/api/dist/server.js'], {
      env: { ...process.env, FOURFOLD_PORT: String(TEST_PORT), FOURFOLD_DB: join(this.dir, 'fourfold.db'), FOURFOLD_NOW: local },
      stdio: 'pipe',
    });
    await expect.poll(async () => fetch(`${BASE_URL}/api/task-list`).then((r) => r.ok, () => false), { timeout: 10_000 }).toBe(true);
  }

  async stop() {
    const proc = this.proc;
    if (!proc || proc.exitCode !== null) return;
    const exited = new Promise((r) => proc.once('exit', r));
    proc.kill();
    await exited;
  }

  cleanUp() {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** The API, driven straight from the test: for setting up data, and for changes made "in another window". */
export function apiClient() {
  const client = createClient(BASE_URL);
  return {
    ...client,
    async write(...texts: string[]) {
      const ids: string[] = [];
      for (const text of texts) ids.push((await client.write(randomUUID(), text)).id);
      return ids;
    },
  };
}

/** Local time, e.g. at('2026-09-24', '19:59'). */
export function at(date: string, time = '10:00') {
  return new Date(`${date}T${time}:00`);
}

export const test = base.extend<{ startAt: Date; pageAt: Date | undefined; server: Server; api: ReturnType<typeof apiClient>; app: Page }>({
  /** Where the server's clock starts. */
  startAt: [at('2026-09-24'), { option: true }],
  /** The browser's time, if not the same as startAt (e.g. to look, days later, at Matrices set up earlier). */
  pageAt: [undefined, { option: true }],
  server: async ({ startAt }, use) => {
    const server = new Server(startAt);
    await server.run();
    await use(server);
    await server.stop();
    server.cleanUp();
  },
  api: async ({ server: _ }, use) => use(apiClient()),
  /** The page, with its clock pinned to the test's time, opened on Fourfold. */
  app: async ({ page, startAt, pageAt, server: _ }, use) => {
    await page.clock.setFixedTime(pageAt ?? startAt);
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: 'Task List' })).toBeVisible();
    await use(page);
  },
});

export { expect };
