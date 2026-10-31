#!/usr/bin/env node
/**
 * Adds a checkpoint quiz to the LOCAL sample course (run seed.mjs first),
 * through the public API as the local instructor. Idempotent. Same safety
 * rules as seed.mjs: vibe_v3_local only, Firebase Auth emulator only.
 *
 *   node tools/local-api/seed-quiz.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:4001/api';
const EMULATOR = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const dbEnv = Object.fromEntries(
  readFileSync(join(homedir(), '.config/vibe-v3/atlas.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
if (!dbEnv.DB_NAME?.startsWith('vibe_v3_local')) throw new Error(`Refusing to seed: DB_NAME is "${dbEnv.DB_NAME}"`);

const QUIZ_NAME = 'Checkpoint: arrays and lookups';

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
  if (!res.ok) {
    const details = data.errors ? ' ' + JSON.stringify(data.errors.map((e) => ({ property: e.property, constraints: e.constraints, children: e.children?.length }))) : '';
    throw new Error(`${method} ${path} → ${res.status}: ${data.message ?? text}${details}`);
  }
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

const ids = JSON.parse(
  mongo(`const c = db.newCourse.findOne({name: 'Sample: Foundations of Data Structures'});
    const v = db.newCourseVersion.findOne({_id: c.versions[0]});
    const m = v.modules.find((x) => x.name === 'Getting started');
    const s = m.sections.find((x) => x.name === 'Orientation');
    print(JSON.stringify({courseId: c._id.toString(), versionId: v._id.toString(), moduleId: m.moduleId.toString(), sectionId: s.sectionId.toString()}));`),
);

const existing = await call('GET', `/courses/versions/${ids.versionId}/modules/${ids.moduleId}/sections/${ids.sectionId}/items`, null, token);
if (existing.some((i) => i.name === QUIZ_NAME)) {
  console.log('quiz already exists; nothing to do');
  process.exit(0);
}
const afterVideo = existing.find((i) => i.name === 'Arrays in practice');

const lot = (text, explaination) => ({ text, explaination });
const base = (text, type, hint) => ({ text, type, isParameterized: false, parameters: [], hint, timeLimitSeconds: 120, points: 2, priority: 'MEDIUM' });

const questions = [
  {
    question: base('What is the time complexity of reading arr[i] from an array?', 'SELECT_ONE_IN_LOT', 'Arrays store elements contiguously.'),
    solution: {
      correctLotItem: lot('O(1)', 'The address is computed directly from the index.'),
      incorrectLotItems: [lot('O(log n)', 'That is binary search, not indexing.'), lot('O(n)', 'No scan is needed to reach an index.'), lot('O(n log n)', 'That is typical of comparison sorting.')],
    },
  },
  {
    question: base('Which data structure gives constant-time lookups by key on average?', 'SELECT_ONE_IN_LOT', 'Think hashing.'),
    solution: {
      correctLotItem: lot('A hash map', 'Hashing maps a key straight to a bucket.'),
      incorrectLotItems: [lot('A linked list', 'Lookups walk the list: O(n).'), lot('A binary heap', 'Heaps find the min/max fast, not arbitrary keys.')],
    },
  },
  {
    question: base('Which of these operations are O(1) on a dynamic array (amortised)? Select all that apply.', 'SELECT_MANY_IN_LOT', 'Consider where the change happens.'),
    solution: {
      correctLotItems: [lot('Append to the end', 'Amortised O(1) thanks to geometric resizing.'), lot('Read by index', 'Direct address computation.')],
      incorrectLotItems: [lot('Insert at the front', 'Every element must shift: O(n).'), lot('Search for a value', 'Unsorted search is O(n).')],
    },
  },
  {
    question: base('An array has 8 elements. What is the index of its last element?', 'NUMERIC_ANSWER_TYPE', 'Indices start at 0.'),
    // lowerLimit/upperLimit are tolerances around `value`, not absolute bounds.
    solution: { decimalPrecision: 0, upperLimit: 0, lowerLimit: 0, value: 7 },
  },
  {
    question: base('Order these from fastest to slowest typical lookup by key.', 'ORDER_THE_LOTS', 'Constant beats logarithmic beats linear.'),
    solution: {
      ordering: [
        { lotItem: lot('Hash map', 'O(1) on average.'), order: 1 },
        { lotItem: lot('Balanced binary search tree', 'O(log n).'), order: 2 },
        { lotItem: lot('Unsorted array', 'O(n) scan.'), order: 3 },
      ],
    },
  },
];

const bank = await call('POST', '/quizzes/question-bank', {
  courseId: ids.courseId,
  courseVersionId: ids.versionId,
  title: 'Arrays and lookups',
  description: 'Local sample question bank',
  tags: ['sample'],
  // A bank's points overwrite each added question's points (even when unset), so set them here.
  points: 2,
}, token);
const bankId = bank.questionBankId ?? bank._id ?? bank.id;
console.log('bank', bankId);

for (const q of questions) {
  const created = await call('POST', '/quizzes/questions', q, token);
  const questionId = created.questionId ?? created._id ?? created.id;
  await call('PATCH', `/quizzes/question-bank/${bankId}/questions/${questionId}/add`, null, token);
  console.log('question', q.question.type, questionId);
}

const item = await call('POST', `/courses/versions/${ids.versionId}/modules/${ids.moduleId}/sections/${ids.sectionId}/items`, {
  name: QUIZ_NAME,
  description: 'Five quick questions on what you just watched.',
  type: 'QUIZ',
  ...(afterVideo ? { afterItemId: afterVideo._id } : {}),
  quizDetails: {
    passThreshold: 0.6,
    maxAttempts: -1,
    quizType: 'NO_DEADLINE',
    approximateTimeToComplete: '00:05:00',
    allowPartialGrading: true,
    allowHint: true,
    allowSkip: false,
    showCorrectAnswersAfterSubmission: true,
    showExplanationAfterSubmission: true,
    showScoreAfterSubmission: true,
    questionVisibility: 5,
    releaseTime: new Date().toISOString(),
  },
}, token);
const quizItems = await call('GET', `/courses/versions/${ids.versionId}/modules/${ids.moduleId}/sections/${ids.sectionId}/items`, null, token);
const quizId = quizItems.find((i) => i.name === QUIZ_NAME)._id;
await call('POST', `/quizzes/quiz/${quizId}/bank`, { bankId, count: 5 }, token);
console.log('quiz', quizId, item ? 'created' : '');
