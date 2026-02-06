import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Keep artifacts predictable and easy to ignore
  outputDir: 'test-results',

  // Smoke tests should fail fast
  timeout: 30 * 1000,

  // No retries for smoke tests
  retries: 0,

  use: {
    // Base URL for the app
    baseURL: 'http://localhost:5173',

    // Required for CI
    headless: true,

    // Only capture artifacts on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});
