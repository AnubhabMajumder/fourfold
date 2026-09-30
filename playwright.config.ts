import { defineConfig, devices } from '@playwright/test';

// Each test starts its own Fourfold server (built by `pnpm test:e2e`) on one test port, so tests run one at a time.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
});
