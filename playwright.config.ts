import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8001',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: '.venv/bin/python tests/serve_e2e.py',
    url: 'http://127.0.0.1:8001/api/profiles',
    reuseExistingServer: false,
  },
});
