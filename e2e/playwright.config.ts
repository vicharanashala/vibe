import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Keep artifacts predictable and easy to ignore
  outputDir: 'test-results',

  timeout: 60 * 60 * 1000,
  retries: 0,
  workers: 1,

  use: {
    // Base URL for the app
    baseURL: process.env.BASE_URL || "http://localhost:5173",

    // Required for CI
    permissions: ['camera', 'microphone'],
    headless: true,
    // Only capture artifacts on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-gl=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',

        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--use-file-for-fake-video-capture=./assets/webcam-face.y4m',
        '--use-file-for-fake-audio-capture=./assets/webcam-face.wav',

        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    },
  },
});
