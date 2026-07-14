// scripts/drive-companion-progress.cjs
// Drives the companion's growth and mood directly by writing to Mongo.
// Usage: node scripts/drive-companion-progress.cjs <percentCompleted> [quizScore]
//
//   <percentCompleted>  0..100  (drives stage 0..5 and mood neutral|studying|happy|excited)
//   [quizScore]         0..100  (drives realQuizScore; mood uses it through frontend only)
//
// Side effects:
//   - Upserts an enrollment for the userId in .seed-state.json (or matches by user/course)
//   - Sets enrollment.percentCompleted = <percentCompleted>
//   - Inserts a synthetic quiz_submission_results doc (one per call) with gradingResult.totalScore = <quizScore>
//
// This does NOT modify any existing real data; it only touches the seeded test course.

const {MongoClient, ObjectId} = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const STATE_PATH = path.join(__dirname, '..', '..', 'scripts', '.seed-state.json');

const percentCompleted = Math.max(0, Math.min(100, parseInt(process.argv[2] ?? '0', 10)));
const quizScore = process.argv[3] !== undefined
  ? Math.max(0, Math.min(100, parseInt(process.argv[3], 10)))
  : null;

(async () => {
  if (!fs.existsSync(STATE_PATH)) {
    console.error(`[drive] Missing ${STATE_PATH} — run scripts/seed-test-course.cjs first`);
    process.exit(1);
  }
  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const {userId, courseId, courseVersionId, quizItemId} = state;
  const userOid = new ObjectId(userId);
  const courseOid = new ObjectId(courseId);
  const versionOid = new ObjectId(courseVersionId);

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // Upsert enrollment
  const now = new Date();
  const enrRes = await db.collection('enrollment').findOneAndUpdate(
    {userId: userOid, courseId: courseOid, courseVersionId: versionOid},
    {
      $set: {
        userId: userOid,
        courseId: courseOid,
        courseVersionId: versionOid,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: now,
        percentCompleted,
        completedItemsCount: Math.round((percentCompleted / 100) * 2),  // we have 2 items
      },
    },
    {upsert: true, returnDocument: 'after'},
  );
  const enr = enrRes.value || enrRes;  // mongodb driver 6.x returns the doc directly; 5.x wraps in .value
  console.log(`[drive] enrollment.percentCompleted = ${enr.percentCompleted}`);

  if (quizScore !== null) {
    // Insert a synthetic quiz_submission_results doc.
    // Each call adds a new doc so realQuizScore becomes a moving average (close enough for visual test).
    await db.collection('quiz_submission_results').insertOne({
      _id: new ObjectId(),
      userId: userOid,
      quizId: new ObjectId(quizItemId),
      cohortId: null,
      gradingResult: {
        totalScore: quizScore,
        totalMaxScore: 100,
      },
      createdAt: now,
      updatedAt: now,
      _synthetic: true,  // marker for cleanup
    });
    console.log(`[drive] inserted quiz_submission_results with totalScore = ${quizScore}`);
  }

  // Now fetch companion state to confirm
  const token = await fetchIdToken();
  const cm = await fetch('http://127.0.0.1:3141/api/companion/me', {
    headers: {Authorization: `Bearer ${token}`},
  });
  const text = await cm.text();
  console.log(`\n[companion /api/companion/me → ${cm.status}]`);
  console.log(text || '(empty body — no animal picked)');

  await client.close();
})().catch(err => { console.error('[drive] FAILED:', err); process.exit(1); });

async function fetchIdToken() {
  const si = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=***',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: 'sahasra2069@gmail.com',
        password: 'StrongP@ss123',
        returnSecureToken: true,
      }),
    },
  );
  const j = await si.json();
  return j.idToken;
}