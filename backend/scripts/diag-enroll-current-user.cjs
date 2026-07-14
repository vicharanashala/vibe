#!/usr/bin/env node
// diag-enroll-current-user.cjs — Enroll a specific userId (or email) in the test course
// Usage:
//   node diag-enroll-current-user.cjs                       (uses CURRENT_USER_ID env or default)
//   $env:CURRENT_USER_ID='6a4b9f85cc68bde40897fc16'; node diag-enroll-current-user.cjs
//   $env:CURRENT_USER_EMAIL='sahasra@...' ; node diag-enroll-current-user.cjs
//
// Creates:
//   - APPROVED course_registrations row
//   - ACTIVE enrollment row (with percentCompleted=0, isDeleted=false)
//   - companion row (panda, stage 0)
// Skips creation if any of those already exist.

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

const COURSE_ID = '6a50cb21b59da603242f22ab';
const VERSION_ID = '6a50cb21b59da603242f22ac';

const CURRENT_USER_ID = process.env.CURRENT_USER_ID || '';
const CURRENT_USER_EMAIL = process.env.CURRENT_USER_EMAIL || '';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Resolve userId
    let userId;
    if (CURRENT_USER_ID) {
      userId = new ObjectId(CURRENT_USER_ID);
      console.log(`Using userId from CURRENT_USER_ID env: ${CURRENT_USER_ID}`);
    } else if (CURRENT_USER_EMAIL) {
      const user = await db.collection('users').findOne({ email: CURRENT_USER_EMAIL });
      if (!user) throw new Error(`No user with email=${CURRENT_USER_EMAIL}`);
      userId = user._id;
      console.log(`Resolved userId from email: ${userId.toString()}`);
    } else {
      throw new Error('Set CURRENT_USER_ID or CURRENT_USER_EMAIL env var');
    }

    // Verify the user exists
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) throw new Error(`No user with _id=${userId.toString()}`);
    console.log(`User found: email=${user.email}, roles=${JSON.stringify(user.roles)}`);

    // Verify the course / version exist
    const course = await db.collection('newCourse').findOne({ _id: new ObjectId(COURSE_ID) });
    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    if (!course || !version) {
      throw new Error(`Course/version missing: course=${!!course}, version=${!!version}. Run bootstrap-fresh-state.cjs first.`);
    }
    console.log(`Course: "${course.name}", versionStatus=${version.versionStatus}, autoApprove=${version.autoApprove}`);

    // Wipe existing data for this user/version
    const regDel = await db.collection('course_registrations').deleteMany({
      userId,
      courseVersionId: new ObjectId(VERSION_ID),
    });
    const enrDel = await db.collection('enrollment').deleteMany({
      userId,
      courseVersionId: new ObjectId(VERSION_ID),
    });
    const compDel = await db.collection('companions').deleteMany({
      userId,
      courseVersionId: new ObjectId(VERSION_ID),
    });
    console.log(`Wiped: registrations=${regDel.deletedCount}, enrollments=${enrDel.deletedCount}, companions=${compDel.deletedCount}`);

    // 1) APPROVED registration
    const regResult = await db.collection('course_registrations').insertOne({
      userId,
      studentId: userId,
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
      status: 'APPROVED',
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Registration APPROVED: _id=${regResult.insertedId}`);

    // 2) ACTIVE enrollment
    const enrResult = await db.collection('enrollment').insertOne({
      userId,
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
      role: 'STUDENT',
      status: 'ACTIVE',
      enrollmentDate: new Date(),
      percentCompleted: 0,
      completedItemsCount: 0,
      totalItemsCount: 4,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Enrollment ACTIVE: _id=${enrResult.insertedId}`);

    // 3) Companion panda (use updateOne upsert so we don't trip the userId_1 unique index)
    const compResult = await db.collection('companions').updateOne(
      { userId },
      {
        $set: {
          userId,
          courseId: new ObjectId(COURSE_ID),
          courseVersionId: new ObjectId(VERSION_ID),
          animal: 'panda',
          stage: 0,
          percentCompleted: 0,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    if (compResult.upsertedCount === 1) {
      console.log(`✓ Companion panda (stage 0): _id=${compResult.upsertedId}`);
    } else {
      console.log(`✓ Companion panda (stage 0): updated existing row`);
    }

    console.log('\n>>> Done. Now:');
    console.log('>>> 1) Restart the backend (Task Manager → kill node.exe → pnpm dev)');
    console.log('>>> 2) Hard-refresh dashboard (Ctrl+Shift+R)');
    console.log('>>> 3) Test course should appear in Enrolled section');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();