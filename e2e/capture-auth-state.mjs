import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { chromium } from '@playwright/test';

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

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

async function waitForEnter(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise((resolve) => rl.question(promptText, resolve));
  rl.close();
}

async function main() {
  loadDotEnv(path.resolve('.env'));

  const baseURL = process.env.BASE_URL || 'http://localhost:5173';
  const storageStatePath = path.resolve('playwright/.auth/student.json');
  const userDataDir = path.resolve('playwright/.chrome-profile');
  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = await context.newPage();

  console.log(`Opening ${baseURL} in Chrome...`);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  console.log('Log in manually (Google or normal login).');
  console.log('After reaching your in-app dashboard/home, return here.');
  await waitForEnter('Press Enter to save auth state... ');

  await context.storageState({ path: storageStatePath, indexedDB: true });
  console.log(`Saved storage state to: ${storageStatePath}`);

  await context.close();
}

main().catch((error) => {
  console.error('Failed to capture auth state:', error);
  process.exit(1);
});
