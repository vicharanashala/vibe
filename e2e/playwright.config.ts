import fs from 'fs';
import path from 'path';
import { defineConfig } from '@playwright/test';

function loadDotEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const envPath = path.resolve(__dirname, '.env');
loadDotEnv(envPath);

const storageStatePath = process.env.E2E_STORAGE_STATE;

export default defineConfig({
  testDir: './tests',

  // Keep artifacts predictable and easy to ignore
  outputDir: 'test-results',

  timeout: 10 * 60 * 60 * 1000, //10 hours
  retries: 0,
  workers: 1,

  use: {
    // Base URL for the app
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    storageState: storageStatePath || undefined,

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
      ],
    },
  },
});
