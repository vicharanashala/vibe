#!/usr/bin/env node
/**
 * Seeds a second LOCAL course with course registration OPEN (manual approval),
 * through the public API as the local instructor. Idempotent.
 * Registration link: http://localhost:4300/register/<versionId>
 *
 *   node tools/local-api/seed-registration.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:4001/api';
const EMULATOR = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const COURSE = 'Sample: Introduction to Algorithms';

const dbEnv = Object.fromEntries(
  readFileSync(join(homedir(), '.config/vibe-v3/atlas.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
if (!dbEnv.DB_NAME?.startsWith('vibe_v3_local')) throw new Error(`Refusing to seed: DB_NAME is "${dbEnv.DB_NAME}"`);
const mongo = (js) =>
  execFileSync('mongosh', [dbEnv.DB_URL, '--quiet', '--eval', `db = db.getSiblingDB(${JSON.stringify(dbEnv.DB_NAME)}); ${js}`], { encoding: 'utf8' }).trim();

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.message ?? text}`);
  return data;
}

const token = (
  await (
    await fetch(`${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'instructor@vibe.local', password: 'Password123!', returnSecureToken: true }),
    })
  ).json()
).idToken;
if (!token) throw new Error('Instructor not found in the emulator — run seed.mjs first');

let existing = mongo(`const c = db.newCourse.findOne({name: ${JSON.stringify(COURSE)}}); print(c ? c._id + ' ' + c.versions[0] : '')`);
let courseId, versionId;
if (existing) {
  [courseId, versionId] = existing.split(' ');
  console.log('course exists', courseId);
} else {
  const course = await call('POST', '/courses/', {
    name: COURSE,
    description: 'Sorting, searching and the ideas behind efficient programs.',
    versionName: 'Version 1',
    versionDescription: 'Local sample version',
  }, token);
  courseId = course._id;
  versionId = String(course.versions[0]);
  console.log('course created', courseId);
}

// Content, if the course is empty.
const version = await call('GET', `/courses/versions/${versionId}`, null, token);
if (!(version.modules ?? []).length) {
  const m = (await call('POST', `/courses/versions/${versionId}/modules`, { name: 'Sorting', description: 'Putting things in order, fast.' }, token)).version.modules[0].moduleId;
  const s = (await call('POST', `/courses/versions/${versionId}/modules/${m}/sections`, { name: 'Simple sorts', description: 'Where everyone starts.' }, token))
    .version.modules[0].sections[0].sectionId;
  await call('POST', `/courses/versions/${versionId}/modules/${m}/sections/${s}/items`, {
    name: 'Why sorting matters', description: 'Why sorting matters', type: 'BLOG',
    blogDetails: { content: 'Sorted data makes searching, merging and de-duplicating far cheaper.', estimatedReadTimeInMinutes: 2, points: '5' },
  }, token);
  await call('POST', `/courses/versions/${versionId}/modules/${m}/sections/${s}/items`, {
    name: 'Bubble sort in 5 seconds', description: 'Bubble sort in 5 seconds', type: 'VIDEO',
    videoDetails: { URL: 'https://www.youtube.com/watch?v=xli_FI7CuzA', startTime: '00:00:00', endTime: '00:00:05', points: 10 },
  }, token);
  console.log('content added');
}

// Registration form: the backend's default Name/Email plus one field per type the instructor builder offers.
await call('PUT', `/course/registration/build-form/version/${versionId}`, {
  jsonSchema: {
    type: 'object',
    required: ['Name', 'Email', 'Institution', 'Year'],
    properties: {
      Name: { type: 'string', title: 'Name' },
      Email: { type: 'string', title: 'Email', format: 'email' },
      Institution: { type: 'string', title: 'Institution' },
      Year: { type: 'string', title: 'Year of study', enum: ['1st year', '2nd year', '3rd year', '4th year', 'Graduate'] },
      Mode: { type: 'string', title: 'Preferred learning mode', enum: ['Weekdays', 'Weekends'] },
      Experience: { type: 'integer', title: 'Years of programming experience', minimum: 0, maximum: 40 },
      StartDate: { type: 'string', title: 'When can you start?', format: 'date' },
      Motivation: { type: 'string', title: 'Why do you want to join?' },
      Agree: { type: 'boolean', title: 'I will complete the course honestly, without outside help on assessments' },
    },
  },
  uiSchema: {
    Name: { 'ui:placeholder': 'Enter your Name' },
    Email: { 'ui:placeholder': 'Enter your Email' },
    Institution: { 'ui:placeholder': 'College or organisation' },
    Year: { 'ui:widget': 'select' },
    Mode: { 'ui:widget': 'radio' },
    Experience: { 'ui:widget': 'updown' },
    StartDate: { 'ui:widget': 'date' },
    Motivation: { 'ui:widget': 'textarea', 'ui:placeholder': 'A sentence or two is plenty' },
    Agree: { 'ui:widget': 'checkbox' },
  },
}, token);
await call('PATCH', `/course/registration/registration/version/${versionId}/toggle`, { isActive: true }, token);
await call('PUT', `/course/registration/auto-approval/version/${versionId}`, { registrationsAutoApproved: false, autoapproval_emails: [] }, token);
console.log(`registration open (manual approval): http://localhost:4300/register/${versionId}`);
