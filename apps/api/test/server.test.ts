// Starts the real server process, to check how it behaves when its port is already taken.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const apiRoot = fileURLToPath(new URL('..', import.meta.url));

it('prints a clear message and exits, without trying another port, when its port is taken', async () => {
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const port = (blocker.address() as AddressInfo).port;
  const dir = mkdtempSync(join(tmpdir(), 'fourfold-test-'));
  try {
    const proc = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      cwd: apiRoot,
      env: { ...process.env, FOURFOLD_PORT: String(port), FOURFOLD_DB: join(dir, 'fourfold.db') },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    const code = await new Promise((resolve) => proc.once('exit', resolve));

    expect(code).toBe(1);
    expect(stderr).toContain(`port ${port} is already in use`);
    expect(stdout).not.toContain('Fourfold is running');
  } finally {
    blocker.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 20_000);
