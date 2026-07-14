#!/usr/bin/env node
// diag-who-am-i.cjs — Identify which user is actually logged in vs which user we expect
// More resilient version with topology refresh + directConnection

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const EXPECTED_USER_ID = '6a46ec683f01733f189df8a3';
const ACTUAL_USER_ID = '6a4b9f85cc68bde40897fc16';
const COURSE_ID = '6a50cb21b59da603242f22ab';
const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  // Use directConnection + retry to dodge stale topology
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  USER IDENTITY DIAGNOSTIC                                    │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // 1. Users collection — list every user and highlight the two interesting IDs
    console.log('📋 USERS COLLECTION (all users):');
    const users = await db.collection('users').find({}).toArray();
    if (users.length === 0) {
      console.log('  ⚠️  No users in collection!');
    }
    for (const u of users) {
      const id = u._id.toString();
      const marker =
        id === EXPECTED_USER_ID ? ' ← EXPECTED TEST LEARNER'
        : id === ACTUAL_USER_ID  ? ' ← ACTUAL LOGGED-IN USER'
        : '';
      console.log(`  • _id=${id}${marker}`);
      console.log(`    email=${u.email}, roles=${JSON.stringify(u.roles)}, name=${u.name ?? '?'}`);
    }

    // 2. Enrollments — for the expected test learner (string OR ObjectId userId)
    console.log('\n📋 ENROLLMENT COLLECTION (entries for either interesting userId):');
    let enrollments = await db.collection('enrollment').find({
      userId: { $in: [EXPECTED_USER_ID, ACTUAL_USER_ID].map(s => new ObjectId(s)) },
    }).toArray();
    if (enrollments.length === 0) {
      // try string form too
      enrollments = await db.collection('enrollment').find({
        userId: { $in: [EXPECTED_USER_ID, ACTUAL_USER_ID] },
      }).toArray();
    }
    if (enrollments.length === 0) {
      console.log('  ⚠️  NO enrollments found for either user!');
    }
    for (const e of enrollments) {
      console.log(`  • _id=${e._id.toString()}`);
      console.log(`    userId=${e.userId.toString()}, role=${e.role}, status=${e.status}, isDeleted=${e.isDeleted ?? false}`);
      console.log(`    courseId=${e.courseId.toString()}, courseVersionId=${e.courseVersionId?.toString?.() ?? e.courseVersionId}`);
      console.log(`    percentCompleted=${e.percentCompleted ?? '?'}, totalItemsCount=${e.totalItemsCount ?? '?'}, completedItemsCount=${e.completedItemsCount ?? '?'}`);
    }

    // 3. Course registrations — for the same two users
    console.log('\n📋 COURSE_REGISTRATIONS COLLECTION (entries for either interesting userId):');
    let regs = await db.collection('course_registrations').find({
      userId: { $in: [EXPECTED_USER_ID, ACTUAL_USER_ID].map(s => new ObjectId(s)) },
    }).toArray();
    if (regs.length === 0) {
      regs = await db.collection('course_registrations').find({
        userId: { $in: [EXPECTED_USER_ID, ACTUAL_USER_ID] },
      }).toArray();
    }
    if (regs.length === 0) {
      console.log('  ⚠️  NO course registrations found for either user!');
    }
    for (const r of regs) {
      console.log(`  • _id=${r._id.toString()}`);
      console.log(`    userId=${r.userId.toString()}, status=${r.status}, courseVersionId=${r.courseVersionId?.toString?.() ?? r.courseVersionId}`);
    }

    // 4. Sanity check — is the test course / version still intact?
    console.log('\n📋 TEST COURSE & VERSION (sanity check):');
    const course = await db.collection('newCourse').findOne({ _id: new ObjectId(COURSE_ID) });
    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    if (!course) console.log('  ❌ course not found in newCourse');
    else console.log(`  ✓ course name="${course.name}", versions=${JSON.stringify((course.versions || []).map(v => v.toString()))}`);
    if (!version) console.log('  ❌ version not found in newCourseVersion');
    else console.log(`  ✓ version versionStatus=${version.versionStatus}, autoApprove=${version.autoApprove}`);

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nIf you see "primary marked stale" — Mongo restarted or had an election. Restart the backend to refresh its topology.');
  } finally {
    await client.close();
  }
})();