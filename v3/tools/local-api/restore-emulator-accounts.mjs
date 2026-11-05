#!/usr/bin/env node
/**
 * Re-creates Firebase Auth emulator logins for every user in the local
 * vibe_v3_local database, with the SAME uid the database stores, so progress
 * and enrolments keep working after the emulator loses its in-memory accounts
 * (it only exports them on a clean shutdown).
 *
 * Seeded test accounts get "Password123!". Anyone else gets the temporary
 * password below (printed), which they can change on the Profile page.
 * Accounts that already exist in the emulator are left alone.
 *
 *   node tools/local-api/restore-emulator-accounts.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const EMULATOR = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const TEST_PASSWORD = 'Password123!';
const TEMP_PASSWORD = 'ViBe-local-2026!';

const dbEnv = Object.fromEntries(
  readFileSync(join(homedir(), '.config/vibe-v3/atlas.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
if (!dbEnv.DB_NAME?.startsWith('vibe_v3_local')) throw new Error(`Refusing: DB_NAME is "${dbEnv.DB_NAME}"`);

const users = JSON.parse(
  execFileSync(
    'mongosh',
    [dbEnv.DB_URL, '--quiet', '--eval', `print(JSON.stringify(db.getSiblingDB(${JSON.stringify(dbEnv.DB_NAME)}).users.find({}, {email: 1, firebaseUID: 1, firstName: 1, lastName: 1, _id: 0}).toArray()))`],
    { encoding: 'utf8' },
  ),
);

const admin = (path, body) =>
  fetch(`${EMULATOR}/identitytoolkit.googleapis.com/v1/projects/demo-vibe/${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const existing = new Set(((await admin('accounts:query', {})).userInfo ?? []).map((u) => u.localId));

for (const u of users) {
  if (!u.firebaseUID || !u.email) continue;
  if (existing.has(u.firebaseUID)) {
    console.log(`exists    ${u.email}`);
    continue;
  }
  const isTest = u.email.endsWith('@vibe.local');
  const password = isTest ? TEST_PASSWORD : TEMP_PASSWORD;
  const result = await admin('accounts', {
    localId: u.firebaseUID,
    email: u.email,
    password,
    displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || undefined,
  });
  if (result.error) throw new Error(`${u.email}: ${result.error.message}`);
  console.log(`restored  ${u.email}${isTest ? '' : `  (temporary password: ${TEMP_PASSWORD})`}`);
}
