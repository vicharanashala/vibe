#!/usr/bin/env node
/**
 * Seed the LOCAL ViBe backend with a test instructor, a test student and one
 * small sample course, entirely through the public API (plus one direct DB
 * update to give the local instructor the admin role, which no API can do).
 *
 * Safety: refuses to run unless DB_NAME starts with "vibe_v3_local" and the
 * Firebase Auth emulator is configured. Never touches staging/production data.
 *
 * Usage (local stack running — see tools/local-api/README.md):
 *   node tools/local-api/seed.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:4001/api';
const EMULATOR = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const configDir = join(homedir(), '.config/vibe-v3');

const dbEnv = Object.fromEntries(
  readFileSync(join(configDir, 'atlas.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
if (!dbEnv.DB_NAME?.startsWith('vibe_v3_local')) {
  throw new Error(`Refusing to seed: DB_NAME is "${dbEnv.DB_NAME}", expected vibe_v3_local*`);
}

export const USERS = {
  instructor: { email: 'instructor@vibe.local', password: 'Password123!', firstName: 'Ira', lastName: 'Instructor' },
  student: { email: 'student@vibe.local', password: 'Password123!', firstName: 'Asha', lastName: 'Student' },
};

function mongo(js) {
  return execFileSync('mongosh', [dbEnv.DB_URL, '--quiet', '--eval', `db = db.getSiblingDB(${JSON.stringify(dbEnv.DB_NAME)}); ${js}`], {
    encoding: 'utf8',
  }).trim();
}

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.message ?? text}${data.errors ? ' ' + JSON.stringify(data.errors.map((e) => ({ property: e.property, constraints: e.constraints }))) : ''}`);
  return data;
}

async function ensureUser(u) {
  try {
    await call('POST', '/auth/signup', { ...u, recaptchaToken: 'NO_CAPTCHA' });
    console.log(`created ${u.email}`);
  } catch (e) {
    if (!/exist/i.test(String(e.message))) throw e;
    console.log(`exists  ${u.email}`);
  }
  return mongo(`print(db.users.findOne({email: ${JSON.stringify(u.email)}})._id.toString())`);
}

async function tokenFor(u) {
  const res = await fetch(
    `${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`emulator sign-in failed for ${u.email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

const instructorId = await ensureUser(USERS.instructor);
const studentId = await ensureUser(USERS.student);
mongo(`db.users.updateOne({_id: ObjectId(${JSON.stringify(instructorId)})}, {$set: {roles: 'admin'}})`);

const existing = mongo(`const c = db.newCourse.findOne({name: 'Sample: Foundations of Data Structures'}); print(c ? c._id.toString() : '')`);
if (existing) {
  console.log(`sample course already exists (${existing}); nothing else to do`);
  process.exit(0);
}

const t = await tokenFor(USERS.instructor);

const course = await call('POST', '/courses/', {
  name: 'Sample: Foundations of Data Structures',
  description: 'A small local sample course for developing the v3 student app.',
  versionName: 'Version 1',
  versionDescription: 'Local sample version',
}, t);
const courseId = course._id ?? course.id;
const versionId = String((course.versions ?? [])[0]);
console.log('course', courseId, 'version', versionId);

async function module(name, description) {
  const r = await call('POST', `/courses/versions/${versionId}/modules`, { name, description }, t);
  const mods = r.version?.modules ?? r.modules ?? [];
  return mods.find((m) => m.name === name).moduleId;
}
async function section(moduleId, name, description) {
  const r = await call('POST', `/courses/versions/${versionId}/modules/${moduleId}/sections`, { name, description }, t);
  const mods = r.version?.modules ?? r.modules ?? [];
  return mods.find((m) => m.moduleId === moduleId).sections.find((s) => s.name === name).sectionId;
}
async function item(moduleId, sectionId, body) {
  return call('POST', `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`, body, t);
}

const video = (name, url, end) => ({
  name,
  description: name,
  type: 'VIDEO',
  videoDetails: { URL: url, startTime: '00:00:00', endTime: end, points: 10 },
});
const article = (name, content) => ({
  name,
  description: name,
  type: 'BLOG',
  // tags must be absent (@IsEmpty) and points a decimal string (@IsDecimal).
  blogDetails: { content, estimatedReadTimeInMinutes: 3, points: '5' },
});

const m1 = await module('Getting started', 'What data structures are and why they matter.');
const s1 = await section(m1, 'Orientation', 'Set up and first ideas.');
await item(m1, s1, article('How this course works', 'Each lesson is a short segment followed by a checkpoint question.'));
// Kept to 5 seconds so the green-track flow is quick to test locally.
await item(m1, s1, video('Arrays in practice', 'https://www.youtube.com/watch?v=QJNwK2uJyGs', '00:00:05'));

const m2 = await module('Lookups by key', 'Hash maps and the trade-offs behind them.');
const s2 = await section(m2, 'Hash maps', 'Constant-time lookups on average.');
await item(m2, s2, video('Hash tables explained', 'https://www.youtube.com/watch?v=shs0KM3wKv8', '00:06:00'));
await item(m2, s2, article('When not to use a hash map', 'Ordered data, range queries and memory overhead.'));

await call('POST', `/users/${studentId}/enrollments/courses/${courseId}/versions/${versionId}`, { role: 'STUDENT' }, t);
console.log(`enrolled ${USERS.student.email} in the sample course`);
