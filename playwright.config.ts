import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',

  use: {
    // The dev server serves the app at /ff-e-builder/ due to Vite base config.
    baseURL: 'http://127.0.0.1:4273/ff-e-builder/',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4273 --strictPort',
    url: 'http://127.0.0.1:4273/ff-e-builder/',
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_APP_ID: 'test-app-id',
      VITE_API_BASE_URL: 'http://localhost:8787',
      VITE_E2E_BYPASS_AUTH: 'true',
    },
    reuseExistingServer: !process.env['CI'],
  },
});
