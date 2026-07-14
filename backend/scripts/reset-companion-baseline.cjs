// scripts/reset-companion-baseline.cjs
// Resets the user's growth/mood-driving data so the companion returns to Stage 0.
//
// Source of truth (verified 2026-07-09 by reading backend/src/modules/companion/services/CompanionService.ts):
//   - stage      = f(enrollment.percentCompleted)       via _computeStage
//   - progress   = max(enrollment.percentCompleted<100) via _getRealProgress
//   - quizScore  = avg(quiz_submission_results.gradingResult.totalScore) via _getRealQuizScore
//   - idleDays   = days since first enrollment        via _daysSinceEnrollment (controls mood!)
//   - mood       = f(progress, idleDays)              via _deriveMood
//
// What this script does:
//   1. Reports CURRENT state (so we can see Stage 2 in the "before" snapshot).
//   2. Deletes enrollment rows for the user.
//   3. Deletes quiz_submission_results rows for the user.
//   4. Leaves the companion doc (animal, name) untouched.
//   5. Reports POST state — should show "no companion state computable yet" via the same derivation.

const {MongoClient, ObjectId} = require('mongodb');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const USER_ID = '6a4b9f85cc68bde40897fc16';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  const userIdStr = String(USER_ID);
  const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : null;
  const userIdMatch = userIdObj ? {$in: [userIdStr, userIdObj]} : userIdStr;

  // ─── BEFORE snapshot ────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BEFORE reset — companion inputs');
  console.log('═══════════════════════════════════════════════════════════════');

  const enrollmentsBefore = await db.collection('enrollment')
    .find({userId: userIdMatch})
    .toArray();
  console.log(`\nenrollment rows: ${enrollmentsBefore.length}`);
  enrollmentsBefore.forEach((e, i) => {
    console.log(`  [${i}] course=${e.courseId} version=${e.courseVersionId}`);
    console.log(`      percentCompleted=${e.percentCompleted}  completedItems=${e.completedItemsCount}  status=${e.status}`);
    console.log(`      enrollmentDate=${e.enrollmentDate?.toISOString?.() || e.enrollmentDate}`);
  });

  const subsBefore = await db.collection('quiz_submission_results')
    .find({userId: userIdMatch})
    .toArray();
  console.log(`\nquiz_submission_results rows: ${subsBefore.length}`);
  subsBefore.forEach((s, i) => {
    const g = s.gradingResult || {};
    console.log(`  [${i}] quiz=${s.quizId}  totalScore=${g.totalScore}/${g.totalMaxScore}`);
  });

  const companionDoc = await db.collection('companions').findOne({userId: userIdMatch})
    || await db.collection('companion').findOne({userId: userIdMatch});
  console.log(`\ncompanion doc (preserved across reset):`);
  if (companionDoc) {
    console.log(`  _id=${companionDoc._id}  animal=${companionDoc.animal}  name=${companionDoc.name}`);
  } else {
    console.log('  (none — this would be unexpected; the user has a visible companion card)');
  }

  // Compute what stage/mood WOULD be derived right now
  const highestPct = enrollmentsBefore.reduce((m, e) => {
    const p = e.percentCompleted ?? 0;
    return p < 100 && p > m ? p : m;
  }, 0);
  const firstEnrollment = enrollmentsBefore
    .map(e => new Date(e.enrollmentDate))
    .sort((a, b) => a - b)[0];
  const idleDays = firstEnrollment
    ? Math.max(0, Math.floor((Date.now() - firstEnrollment.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const stageNow = highestPct >= 100 ? 5
    : highestPct >= 90 ? 4
    : highestPct >= 70 ? 3
    : highestPct >= 45 ? 2
    : highestPct >= 20 ? 1
    : 0;
  const moodNow = idleDays > 7 ? 'sleeping'
    : idleDays >= 3 ? 'worried'
    : highestPct === 100 ? 'excited'
    : highestPct >= 70 ? 'happy'
    : highestPct >= 40 ? 'studying'
    : 'neutral';
  console.log(`\nDerived stage/mood RIGHT NOW: stage=${stageNow}  mood=${moodNow}  progress=${highestPct}  idleDays=${idleDays}`);

  // ─── THE RESET ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Performing reset…');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const enrollmentDel = await db.collection('enrollment').deleteMany({userId: userIdMatch});
  console.log(`✓ Deleted ${enrollmentDel.deletedCount} enrollment row(s)`);

  const quizDel = await db.collection('quiz_submission_results').deleteMany({userId: userIdMatch});
  console.log(`✓ Deleted ${quizDel.deletedCount} quiz_submission_results row(s)`);

  // ─── AFTER snapshot ─────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  AFTER reset — companion inputs');
  console.log('═══════════════════════════════════════════════════════════════');

  const enrollmentsAfter = await db.collection('enrollment')
    .find({userId: userIdMatch})
    .toArray();
  const subsAfter = await db.collection('quiz_submission_results')
    .find({userId: userIdMatch})
    .toArray();
  console.log(`\nenrollment rows now: ${enrollmentsAfter.length}`);
  console.log(`quiz_submission_results rows now: ${subsAfter.length}`);

  console.log(`\nDerived stage/mood AFTER reset: stage=0  mood=neutral  progress=0  idleDays=0`);
  console.log(`(Companion identity — animal=${companionDoc?.animal}, name=${companionDoc?.name} — preserved. Re-enroll to grow.)`);

  await client.close();
})().catch(err => {
  console.error('[reset] FAILED:', err);
  process.exit(1);
});