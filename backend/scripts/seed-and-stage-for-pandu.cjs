// scripts/seed-and-stage-for-pandu.cjs
//
// One-shot: seed a public test course AND pre-stage pandu's companion
// at Stage 2 / mood=studying so the dashboard immediately shows growth.
//
// Run: node backend/scripts/seed-and-stage-for-pandu.cjs
//
// What it does:
//   1. Connects to mongodb://127.0.0.1:27017/vibe
//   2. Looks up the user with email "sahasra2069@gmail.com" (pandu)
//   3. Cleans any prior seed of "Test Drive: Companion Demo"
//   4. Seeds:
//        - 1 newCourse, 1 newCourseVersion (active)
//        - 1 courseSettings doc with settings.isPublic = true
//        - 1 module, 1 section, 1 itemsGroup with 1 VIDEO + 1 QUIZ item
//        - 1 quizzes doc with 1 SOL question
//   5. Upserts pandu's enrollment:
//        percentCompleted = 50  (→ companion stage 2)
//        enrollmentDate  = now  (→ idleDays = 0)
//        status=ACTIVE, role=STUDENT, isDeleted!=true
//   6. Inserts a quiz_submission_results doc with totalScore = 80
//   7. Reads /api/companion/me via real fetch (using pandu's auth token)
//      so the final state is verified, not just claimed.
//
// Schema references (verified by reading backend code 2026-07-07/2026-07-08):
//   - newCourse:            {_id, name, description, versions[], categories, instructors, isDeleted}
//   - newCourseVersion:     {_id, courseId, versionStatus, version, modules[]}
//   - courseSettings:       {_id, courseId, courseVersionId, settings: {isPublic, ...}}
//   - itemsGroup:           {_id, sectionId, items: [{itemId, type, order, name}]}
//   - items:                {_id, name, type, ...}
//   - enrollment:           {userId, courseId, courseVersionId, role, status, enrollmentDate, percentCompleted, completedItemsCount}
//   - quiz_submission_results: {userId, quizId, cohortId, gradingResult: {totalScore, totalMaxScore}}
//   - quizzes:              {_id, itemId, title, questions[]}

const {MongoClient, ObjectId} = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const BACKEND = 'http://127.0.0.1:3141';
const AUTH_EMU = 'http://127.0.0.1:9099';
const EMAIL = 'sahasra2069@gmail.com';
const PASSWORD = 'StrongP@ss123';
const STATE_PATH = path.join(__dirname, '..', '..', 'scripts', '.seed-state.json');

// What we want the companion to look like at the end:
//   percentCompleted=50 → _computeStage: stage 2 (45-69 range)
//   enrollmentDate=now  → _daysSinceEnrollment: 0
//   quiz score 80       → avg = 80
//   → CompanionService._deriveMood(50, 0): mood = "studying" (40-69, idle<3)
const TARGET_PERCENT = 50;
const TARGET_QUIZ_SCORE = 80;

function log(...args) { console.log('[seed]', ...args); }
function fail(msg) { console.error('[seed] FAILED:', msg); process.exit(1); }

async function signIn() {
  const r = await fetch(
    `${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: EMAIL, password: PASSWORD, returnSecureToken: true}),
    },
  );
  if (!r.ok) fail(`firebase signin ${r.status}`);
  const j = await r.json();
  if (!j.idToken) fail(`firebase signin no token: ${JSON.stringify(j)}`);
  return j;
}

async function callCompanion(token) {
  const r = await fetch(`${BACKEND}/api/companion/me`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  const text = await r.text();
  return {status: r.status, body: text};
}

(async () => {
  log('Connecting to Mongo…');
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // ── 1. Find pandu ───────────────────────────────────────────────────────
  const user = await db.collection('users').findOne({email: EMAIL});
  if (!user) fail(`no user with email ${EMAIL} — sign up first`);
  const userId = user._id;
  log(`Found pandu: _id=${userId}  email=${user.email}  firstName=${user.firstName}`);

  // ── 2. Clean any prior seed of this exact course name ───────────────────
  log('Cleaning prior seed artifacts (if any)…');
  const existing = await db.collection('newCourse').findOne({name: 'Test Drive: Companion Demo'});
  if (existing) {
    const cId = existing._id;
    const versions = await db.collection('newCourseVersion').find({courseId: cId}).toArray();
    const versionIds = versions.map(v => v._id);
    const sections = await db.collection('newSection').find({courseVersionId: {$in: versionIds}}).toArray();
    const sectionIds = sections.map(s => s._id);
    const groups = await db.collection('itemsGroup').find({sectionId: {$in: sectionIds}}).toArray();
    const groupIds = groups.map(g => g._id);
    const itemRefs = groups.flatMap(g => g.items || []);
    const itemIds = itemRefs.map(i => new ObjectId(i.itemId));
    const modules = await db.collection('newModule').find({courseVersionId: {$in: versionIds}}).toArray();
    const moduleIds = modules.map(m => m._id);

    await db.collection('courseSettings').deleteMany({courseId: cId});
    await db.collection('enrollment').deleteMany({courseId: cId});
    await db.collection('itemsGroup').deleteMany({_id: {$in: groupIds}});
    await db.collection('items').deleteMany({_id: {$in: itemIds}});
    await db.collection('newSection').deleteMany({_id: {$in: sectionIds}});
    await db.collection('newModule').deleteMany({_id: {$in: moduleIds}});
    await db.collection('newCourseVersion').deleteMany({courseId: cId});
    await db.collection('newCourse').deleteOne({_id: cId});
    log(`  Cleaned course ${cId} (${versions.length} version, ${sections.length} sections, ${itemIds.length} items)`);
  }

  // Also wipe any prior synthetic quiz submissions for pandu (so the avg is clean)
  await db.collection('quiz_submission_results').deleteMany({userId, _synthetic: true});
  log('  Cleared prior synthetic quiz rows for pandu');

  // ── 3. Build IDs deterministically ──────────────────────────────────────
  const courseId = new ObjectId();
  const versionId = new ObjectId();
  const moduleId = new ObjectId();
  const sectionId = new ObjectId();
  const itemGroupId = new ObjectId();
  const videoItemId = new ObjectId();
  const quizItemId = new ObjectId();
  const quizId = new ObjectId();
  const questionId = new ObjectId();
  const lotId = new ObjectId();
  const correctOptionId = new ObjectId();
  const enrollmentId = new ObjectId();
  const quizResultId = new ObjectId();
  const now = new Date();

  // ── 4. Insert course structure ──────────────────────────────────────────
  log('Seeding course structure…');

  await db.collection('newCourse').insertOne({
    _id: courseId,
    name: 'Test Drive: Companion Demo',
    description: 'A tiny public course used to demo the companion growth logic. Two short items: a video and a quiz.',
    categories: ['demo', 'companion'],
    versions: [versionId],
    instructors: [userId],  // pandu is both the student AND the listed instructor
                          // (empty instructors array breaks some lookups)
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Module
  await db.collection('newModule').insertOne({
    _id: moduleId,
    courseId,
    courseVersionId: versionId,
    name: 'Module 1: Welcome',
    description: 'First and only module',
    order: '1',
    isHidden: false,
    sectionIds: [sectionId],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Section
  await db.collection('newSection').insertOne({
    _id: sectionId,
    courseId,
    courseVersionId: versionId,
    moduleId,
    name: 'Section 1: Getting started',
    description: 'Watch the video, take the quiz',
    order: '1',
    isHidden: false,
    itemsGroupId,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Course version (with module references nested)
  await db.collection('newCourseVersion').insertOne({
    _id: versionId,
    courseId,
    version: 1,
    name: 'v1',
    description: 'Default version',
    versionStatus: 'active',
    modules: [
      {moduleId, name: 'Module 1: Welcome', order: '1', isHidden: false, sections: [{sectionId, itemsGroupId, name: 'Section 1: Getting started', order: '1', isHidden: false}]},
    ],
    totalItems: 2,
    itemCounts: {VIDEO: 1, QUIZ: 1, BLOG: 0, PROJECT: 0, FEEDBACK: 0},
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Course settings — THIS is what makes the course show up in /api/courses/public
  await db.collection('courseSettings').insertOne({
    _id: new ObjectId(),
    courseId,
    courseVersionId: versionId,
    settings: {
      isPublic: true,
      linearProgressionEnabled: false,
      seekForwardEnabled: true,
      hpSystem: false,
      proctors: {detectors: []},
      registration: {isActive: true},
      timeslots: {isActive: false, slots: []},
      baseHp: 0,
      randomizeItems: false,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Items
  await db.collection('items').insertMany([
    {
      _id: videoItemId,
      name: 'Welcome video (1 min)',
      type: 'VIDEO',
      description: 'A short video to set the stage.',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: quizItemId,
      name: 'Quick check quiz',
      type: 'QUIZ',
      description: 'A one-question quiz on the video content.',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Items group (per the schema, itemsGroups link items to sections)
  await db.collection('itemsGroup').insertOne({
    _id: itemGroupId,
    sectionId,
    items: [
      {itemId: videoItemId.toString(), type: 'VIDEO', order: 1, name: 'Welcome video (1 min)', _id: videoItemId},
      {itemId: quizItemId.toString(), type: 'QUIZ', order: 2, name: 'Quick check quiz', _id: quizItemId},
    ],
    isHidden: false,
    createdAt: now,
    updatedAt: now,
  });

  // Quiz doc — one SOL (single-option) question
  await db.collection('quizzes').insertOne({
    _id: quizId,
    itemId: quizItemId,
    title: 'Quick check quiz',
    description: 'A one-question quiz to verify scoring works.',
    questions: [questionId.toString()],
    createdAt: now,
    updatedAt: now,
  });

  // Question in questionBanks
  await db.collection('questionBanks').insertOne({
    _id: questionId,
    quizId,
    questionText: "What does the companion's mood depend on?",
    questionType: 'SOL',
    parameterized: false,
    hintText: 'Think about what changes as the learner makes progress.',
    timeLimit: 60,
    points: 100,
    priority: 'MEDIUM',
    metaDetails: {creatorId: userId, isStudentGenerated: false, isAIGenerated: false},
    lot: {_id: lotId, lotItems: [
      {_id: correctOptionId, itemText: 'Real course progress and idle time', explaination: 'Mood is derived from real progress + days since first enrollment.'},
      {_id: new ObjectId(), itemText: 'Nothing — it is random', explaination: ''},
      {_id: new ObjectId(), itemText: 'The user\'s birthday', explaination: ''},
    ]},
    solution: {lotItemId: correctOptionId.toString()},
    createdAt: now,
    updatedAt: now,
  });

  log(`  newCourse         ${courseId}`);
  log(`  newCourseVersion  ${versionId}`);
  log(`  courseSettings    isPublic=true`);
  log(`  itemsGroup        ${itemGroupId}`);
  log(`  items             video=${videoItemId} quiz=${quizItemId}`);
  log(`  quizzes           ${quizId} (1 question)`);

  // ── 5. Enroll pandu at the target percent ───────────────────────────────
  log('Upserting pandu enrollment…');
  await db.collection('enrollment').updateOne(
    {userId, courseId, courseVersionId: versionId},
    {
      $set: {
        _id: enrollmentId,
        userId,
        courseId,
        courseVersionId: versionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: now,
        percentCompleted: TARGET_PERCENT,
        completedItemsCount: Math.round((TARGET_PERCENT / 100) * 2),
        hasNewItemsAfterCompletion: false,
        isDeleted: false,
        isEjected: false,
        updatedAt: now,
      },
      $setOnInsert: {createdAt: now},
    },
    {upsert: true},
  );

  // ── 6. Insert a quiz submission with the target score ───────────────────
  log(`Inserting quiz_submission_results with totalScore=${TARGET_QUIZ_SCORE}…`);
  await db.collection('quiz_submission_results').insertOne({
    _id: quizResultId,
    userId,
    quizId,
    cohortId: null,
    gradingResult: {totalScore: TARGET_QUIZ_SCORE, totalMaxScore: 100},
    createdAt: now,
    updatedAt: now,
    _synthetic: true,  // marker so re-running cleans it up
  });

  // ── 7. Save state file for future runs ──────────────────────────────────
  const state = {
    courseId: courseId.toString(),
    courseVersionId: versionId.toString(),
    moduleId: moduleId.toString(),
    sectionId: sectionId.toString(),
    itemGroupId: itemGroupId.toString(),
    videoItemId: videoItemId.toString(),
    quizItemId: quizItemId.toString(),
    quizId: quizId.toString(),
    questionId: questionId.toString(),
    userId: userId.toString(),
    targetPercent: TARGET_PERCENT,
    targetQuizScore: TARGET_QUIZ_SCORE,
  };
  fs.mkdirSync(path.dirname(STATE_PATH), {recursive: true});
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  log(`Wrote state file: ${STATE_PATH}`);

  // ── 8. Verify the companion actually moves ──────────────────────────────
  log('Verifying via /api/companion/me (real fetch)…');
  const fb = await signIn();
  const cmp = await callCompanion(fb.idToken);
  if (cmp.status !== 200) fail(`/api/companion/me returned ${cmp.status}: ${cmp.body}`);
  let parsed;
  try { parsed = JSON.parse(cmp.body); } catch { fail(`non-JSON response: ${cmp.body}`); }

  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('  COMPANION STATE — what pandu will see on the dashboard');
  log('═══════════════════════════════════════════════════════════════');
  log(`  animal          ${parsed.animal}`);
  log(`  stage           ${parsed.stage}  (expected ${TARGET_PERCENT < 20 ? 0 : TARGET_PERCENT < 45 ? 1 : TARGET_PERCENT < 70 ? 2 : TARGET_PERCENT < 90 ? 3 : TARGET_PERCENT < 100 ? 4 : 5})`);
  log(`  mood            ${parsed.mood}   (expected "studying" for 40-69% + idle<3)`);
  log(`  realProgress    ${parsed.realProgress}  (expected ${TARGET_PERCENT})`);
  log(`  realQuizScore   ${parsed.realQuizScore}  (expected ${TARGET_QUIZ_SCORE})`);
  log(`  idleDays        ${parsed.idleDays}  (expected 0)`);
  log('');
  log(`  Seed courseId:  ${courseId}`);
  log(`  Seed versionId: ${versionId}`);
  log('');
  log('  Next: refresh pandu\'s browser at http://127.0.0.1:5173/dashboard');
  log('        and the companion widget should show the new stage+mood.');
  log('═══════════════════════════════════════════════════════════════');

  await client.close();
  process.exit(0);
})().catch(err => fail(err && err.stack ? err.stack : err));
