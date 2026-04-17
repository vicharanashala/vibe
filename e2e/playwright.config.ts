import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Keep artifacts predictable and easy to ignore
  outputDir: 'test-results',

  // Long timeout supports full course traversal with media playback and quizzes.
  timeout: 10 * 60 * 60 * 1000, //10 hours
  retries: 0,
  // Single worker avoids cross-test interference for shared learner/course state.
  workers: 1,

  use: {
    // Base URL for the app
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    // Required for lesson flows that request webcam/microphone access.
    permissions: ['camera', 'microphone'],
    headless: true,

    // Keep CI storage small while preserving useful debug artifacts on failures.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-gl=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',

        // Use deterministic fake media devices for CI and headless environments.
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--use-file-for-fake-video-capture=./assets/webcam-face.y4m',
        '--use-file-for-fake-audio-capture=./assets/webcam-face.wav',

        '--disable-dev-shm-usage',
      ],
    },
  },
});
