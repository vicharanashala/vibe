// scripts/walkthrough-companion-growth.cjs
// Full visual walkthrough:
//  - Show public catalog
//  - Enroll
//  - Drive enrollment.percentCompleted + quiz score
//  - Hit /api/companion/me after each step
//  - Cleanup any prior run

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

async function signIn() {
  const r = await fetch(
    `${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=***`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: EMAIL, password: PASSWORD, returnSecureToken: true}),
    },
  );
  if (!r.ok) throw new Error(`firebase signin failed ${r.status}`);
  const j = await r.json();
  return j.idToken;
}

async function get(label, path, token) {
  const r = await fetch(`${BACKEND}${path}`, {headers: {Authorization: `Bearer ${token}`}});
  const body = await r.text();
  console.log(`${label}  ${r.status}  GET ${path}`);
  console.log('  ', body.slice(0, 400));
  return body;
}

async function post(label, path, token, body) {
  const r = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  console.log(`${label}  ${r.status}  POST ${path}`);
  console.log('  ', text.slice(0, 400));
  return {status: r.status, body: text};
}

async function drive(db, state, percentCompleted, quizScore) {
  const {userId, courseId, courseVersionId, quizItemId} = state;
  const userOid = new ObjectId(userId);
  const courseOid = new ObjectId(courseId);
  const versionOid = new ObjectId(courseVersionId);

  await db.collection('enrollment').updateOne(
    {userId: userOid, courseId: courseOid, courseVersionId: versionOid},
    {
      $set: {
        userId: userOid,
        courseId: courseOid,
        courseVersionId: versionOid,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date(),
        percentCompleted,
        completedItemsCount: Math.round((percentCompleted / 100) * 2),
      },
    },
    {upsert: true},
  );

  if (quizScore !== null) {
    await db.collection('quiz_submission_results').insertOne({
      _id: new ObjectId(),
      userId: userOid,
      quizId: new ObjectId(quizItemId),
      cohortId: null,
      gradingResult: {totalScore: quizScore, totalMaxScore: 100},
      createdAt: new Date(),
      updatedAt: new Date(),
      _synthetic: true,
    });
  }
}

(async () => {
  if (!fs.existsSync(STATE_PATH)) {
    console.error(`missing ${STATE_PATH} — run scripts/seed-test-course.cjs first`);
    process.exit(1);
  }
  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // Reset synthetic quiz rows so the score is deterministic
  await db.collection('quiz_submission_results').deleteMany({_synthetic: true});

  console.log('\n════════ 1. PUBLIC CATALOG ════════');
  const token = await signIn();
  const pubText = await get('STEP-1', '/api/courses/public', token);
  const pubJson = JSON.parse(pubText);
  if (pubJson.totalDocuments === 0) throw new Error('no public courses — re-run seed-test-course.cjs');
  console.log(`→ catalog has ${pubJson.totalDocuments} course(s): ${pubJson.courses.map(c => c.courseName).join(', ')}`);

  console.log('\n════════ 2. ENROLL ════════');
  const enrollUrl = `/api/users/${state.userId}/enrollments/courses/${state.courseId}/versions/${state.courseVersionId}`;
  await post('STEP-2', enrollUrl, token, {role: 'STUDENT'});
  // Re-upsert enrollment (POST may or may not have set row, normalize it via $set)
  await drive(db, state, 0, null);

  console.log('\n════════ 3a. STAGE 0 (0% / no quiz) ════════');
  let r = await get('STEP-3a', '/api/companion/me', token);
  let cm = JSON.parse(r);
  console.log(`→ stage=${cm.stage}  mood=${cm.mood}  realProgress=${cm.realProgress}  realQuizScore=${cm.realQuizScore}`);

  console.log('\n════════ 3b. AFTER VIDEO (50% / quiz 65) ════════');
  await drive(db, state, 50, 65);
  r = await get('STEP-3b', '/api/companion/me', token);
  cm = JSON.parse(r);
  console.log(`→ stage=${cm.stage}  mood=${cm.mood}  realProgress=${cm.realProgress}  realQuizScore=${cm.realQuizScore}`);

  console.log('\n════════ 3c. AFTER FULL COURSE (100% / quiz 85) ════════');
  // Clean and refresh: 100% with new score
  await db.collection('enrollment').updateOne(
    {userId: new ObjectId(state.userId), courseId: new ObjectId(state.courseId), courseVersionId: new ObjectId(state.courseVersionId)},
    {$set: {percentCompleted: 100, completedItemsCount: 2, status: 'ACTIVE'}},
  );
  await db.collection('quiz_submission_results').deleteMany({_synthetic: true});
  await db.collection('quiz_submission_results').insertOne({
    _id: new ObjectId(), userId: new ObjectId(state.userId), quizId: new ObjectId(state.quizItemId),
    cohortId: null, gradingResult: {totalScore: 85, totalMaxScore: 100}, createdAt: new Date(), updatedAt: new Date(), _synthetic: true,
  });
  r = await get('STEP-3c', '/api/companion/me', token);
  cm = JSON.parse(r);
  console.log(`→ stage=${cm.stage}  mood=${cm.mood}  realProgress=${cm.realProgress}  realQuizScore=${cm.realQuizScore}`);

  console.log('\n════════ 4. RESET FOR BROWSER VIEW ════════');
  await db.collection('enrollment').updateOne(
    {userId: new ObjectId(state.userId), courseId: new ObjectId(state.courseId), courseVersionId: new ObjectId(state.courseVersionId)},
    {$set: {percentCompleted: 50, completedItemsCount: 1, status: 'ACTIVE'}},
  );
  await db.collection('quiz_submission_results').deleteMany({_synthetic: true});
  await db.collection('quiz_submission_results').insertOne({
    _id: new ObjectId(), userId: new ObjectId(state.userId), quizId: new ObjectId(state.quizItemId),
    cohortId: null, gradingResult: {totalScore: 80, totalMaxScore: 100}, createdAt: new Date(), updatedAt: new Date(), _synthetic: true,
  });
  r = await get('RESET', '/api/companion/me', token);
  cm = JSON.parse(r);
  console.log(`→ reset to stage=${cm.stage}  mood=${cm.mood}  realProgress=${cm.realProgress}  realQuizScore=${cm.realQuizScore}`);

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });