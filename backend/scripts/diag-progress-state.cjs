#!/usr/bin/env node
// diag-progress-state.cjs — Check current progress/enrollment state for sahasra
// (After completing a video + quiz in the test course)

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const USER_ID = '6a4b9f85cc68bde40897fc16';
const COURSE_ID = '6a50cb21b59da603242f22ab';
const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  CURRENT PROGRESS STATE (sahasra + test course)              │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // 1. Enrollment
    const enrollments = await db.collection('enrollment')
      .find({ userId: new ObjectId(USER_ID) })
      .toArray();
    console.log(`📋 ENROLLMENTS (${enrollments.length}):`);
    for (const e of enrollments) {
      console.log(JSON.stringify(e, null, 2));
    }

    // 2. Progress
    const progresses = await db.collection('progress')
      .find({ userId: new ObjectId(USER_ID) })
      .toArray();
    console.log(`\n📋 PROGRESSES (${progresses.length}):`);
    for (const p of progresses) {
      console.log(JSON.stringify(p, null, 2).slice(0, 2000));
    }

    // 3. WatchTime
    const watchTimes = await db.collection('watchTime')
      .find({ userId: new ObjectId(USER_ID) })
      .toArray();
    console.log(`\n📋 WATCH TIMES (${watchTimes.length}):`);
    for (const w of watchTimes) {
      console.log(JSON.stringify(w, null, 2));
    }

    // 4. Quiz submission results
    const quizSubs = await db.collection('quiz_submission_results')
      .find({ userId: new ObjectId(USER_ID) })
      .toArray();
    console.log(`\n📋 QUIZ SUBMISSION RESULTS (${quizSubs.length}):`);
    for (const q of quizSubs) {
      console.log(JSON.stringify(q, null, 2).slice(0, 1500));
    }

    // 5. Companion
    const companions = await db.collection('companions')
      .find({ userId: new ObjectId(USER_ID) })
      .toArray();
    console.log(`\n📋 COMPANIONS (${companions.length}):`);
    for (const c of companions) {
      console.log(JSON.stringify(c, null, 2));
    }

    // 6. Quiz attempts
    const attempts = await db.collection('quiz_attempts')
      .find({ userId: new ObjectId(USER_ID) })
      .toArray();
    console.log(`\n📋 QUIZ ATTEMPTS (${attempts.length}):`);
    for (const a of attempts) {
      console.log(JSON.stringify(a, null, 2).slice(0, 1500));
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();