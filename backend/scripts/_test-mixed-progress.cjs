const {MongoClient, ObjectId} = require('mongodb');
const PHASE = parseInt(process.argv[2] || '1', 10);
const USER_OBJ = new ObjectId('6a4b9f85cc68bde40897fc16');

const TEST_COURSES = [
  {cid: new ObjectId('6a53311b5b3a0f2ab44dc807'), vid: new ObjectId('6a53311b5b3a0f2ab44dc808')},
  {cid: new ObjectId('6a53311b5b3a0f2ab44dc809'), vid: new ObjectId('6a53311b5b3a0f2ab44dc80a')},
  {cid: new ObjectId('6a53311b5b3a0f2ab44dc80b'), vid: new ObjectId('6a53311b5b3a0f2ab44dc80c')},
];

async function main() {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  if (PHASE === 1) {
    await db.collection('enrollments').deleteMany({userId: USER_OBJ});
    await db.collection('watchTime').deleteMany({userId: USER_OBJ});
    await db.collection('quiz_submission_results').deleteMany({userId: USER_OBJ});
    // Clear so backend sees prev=null on first call and sets lastKnownProgress correctly
    await db.collection('companions').updateOne(
      {userId: String(USER_OBJ)},
      {$set: {lastKnownProgress: null, newJourney: false}},
    );

    await db.collection('enrollments').insertOne({
      userId: USER_OBJ, courseId: TEST_COURSES[0].cid, courseVersionId: TEST_COURSES[0].vid,
      role: 'STUDENT', status: 'COMPLETED', percentCompleted: 100,
      isDeleted: false, createdAt: new Date(Date.now() - 10 * 86400000),
      updatedAt: new Date(), enrollmentDate: new Date(Date.now() - 10 * 86400000),
    });
    console.log('✅ Enrollment 1: COMPLETED at 100%');

    await db.collection('enrollments').insertOne({
      userId: USER_OBJ, courseId: TEST_COURSES[1].cid, courseVersionId: TEST_COURSES[1].vid,
      role: 'STUDENT', status: 'ACTIVE', percentCompleted: 0,
      isDeleted: false, createdAt: new Date(), updatedAt: new Date(), enrollmentDate: new Date(),
    });
    console.log('✅ Enrollment 2: ACTIVE at 0%');

    console.log('\n📊 Expected: realProgress = avg(100, 0) = 50% → Stage 3 (Teen 🌿)');
    console.log('Hard-refresh browser (Ctrl+F5) — companion should show Teen 🌿');
    console.log('\nThen: node backend/scripts/_test-mixed-progress.cjs 2');
  }

  if (PHASE === 2) {
    await db.collection('enrollments').insertOne({
      userId: USER_OBJ, courseId: TEST_COURSES[2].cid, courseVersionId: TEST_COURSES[2].vid,
      role: 'STUDENT', status: 'ACTIVE', percentCompleted: 0,
      isDeleted: false, createdAt: new Date(), updatedAt: new Date(), enrollmentDate: new Date(),
    });
    console.log('✅ Enrollment 3: ACTIVE at 0%');

    // Read the current lastKnownProgress from DB (set by Phase 1 backend call)
    const doc = await db.collection('companions').findOne({userId: String(USER_OBJ)}, {projection: {lastKnownProgress: 1}});
    const prev = doc?.lastKnownProgress ?? 50; // fallback to 50 if not set yet
    const newProgress = 33;
    // Apply same threshold logic the backend uses: prev - newProgress >= 15
    const isNewJourney = prev !== null && prev >= 20 && newProgress <= prev - 15;
    // CRITICAL: write the PREVIOUS progress as lastKnownProgress, not the new one.
    // The backend will compare its computed realProgress (33) against this stored
    // prev value to detect the drop and set newJourney=true in its response.
    await db.collection('companions').updateOne(
      {userId: String(USER_OBJ)},
      {$set: {lastKnownProgress: prev, newJourney: isNewJourney}},
    );
    console.log('\n📊 Expected: realProgress = avg(100, 0, 0) = 33% → Stage 2 (Child 🌱)');
    console.log('prev lastKnownProgress in DB:', prev);
    console.log('newJourney flag set to:', isNewJourney, ' (drop:', prev !== null ? prev - newProgress : 'N/A', 'pts, threshold=15)');
    console.log('Hard-refresh browser — companion should show Child 🌱 AND new-journey message!');
    console.log('\nWhen done: node backend/scripts/_reset-companion-test.cjs');
  }

  await c.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });