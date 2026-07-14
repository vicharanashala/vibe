/**
 * diag-current-state.cjs
 * Shows the CURRENT state of the test enrollment exactly as the backend
 * would see it after my getAllEnrollments fix.
 *
 * Run: node backend/scripts/diag-current-state.cjs
 */
const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_ID = '6a46ec683f01733f189df8a3';
const COURSE_ID = '6a50cb21b59da603242f22ab';
const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  console.log('=== CURRENT ENROLLMENT STATE ===\n');

  // Mirror the exact query the new findAllEnrollmentsForUser() runs:
  const userObjectId = ObjectId.isValid(LEARNER_ID) ? new ObjectId(LEARNER_ID) : null;
  const userFilter = userObjectId ? [LEARNER_ID, userObjectId] : [LEARNER_ID];

  const enrollments = await db
    .collection('enrollment')
    .find({
      userId: { $in: userFilter },
      isDeleted: { $ne: true },
    })
    .toArray();

  console.log(`Found ${enrollments.length} enrollments for userId=${LEARNER_ID}\n`);

  for (const e of enrollments) {
    console.log('--- Enrollment ---');
    console.log(`  _id:                ${e._id}`);
    console.log(`  userId:             ${e.userId} (type=${typeof e.userId})`);
    console.log(`  courseId:           ${e.courseId}`);
    console.log(`  courseVersionId:    ${e.courseVersionId}`);
    console.log(`  role:               ${e.role}`);
    console.log(`  status:             ${e.status}`);
    console.log(`  percentCompleted:   ${e.percentCompleted}`);
    console.log(`  totalItemsCount:    ${e.totalItemsCount}`);
    console.log(`  completedItemsCount:${e.completedItemsCount}`);
    console.log(`  isDeleted:          ${e.isDeleted}`);
    console.log(`  Matches test course: courseId match=${String(e.courseId) === COURSE_ID}, versionId match=${String(e.courseVersionId) === VERSION_ID}`);
    console.log('');
  }

  // Check what the AbilityDecorator gets
  console.log('=== WHAT THE ABILITY DECORATOR SEES ===\n');
  const abilityInput = enrollments.map(e => ({
    courseId: e.courseId?.toString(),
    courseVersionId: e.courseVersionId?.toString(),
    role: e.role,
    status: e.status,
  }));
  console.log(JSON.stringify(abilityInput, null, 2));

  if (abilityInput.length === 0) {
    console.log('\n❌ EMPTY! Ability decorator sees nothing → all permissions denied → 403 on protected endpoints');
  } else {
    console.log(`\n✅ Ability decorator has ${abilityInput.length} enrollment(s) → can build CASL ability graph`);
    console.log('   Expected: STUDENT ability on CourseVersion(' + VERSION_ID + ') = View + access');
  }

  // Quick check on the test course
  console.log('\n=== TEST COURSE / VERSION ===\n');
  const course = await db.collection('newCourse').findOne({ _id: new ObjectId(COURSE_ID) });
  const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
  console.log('Course:  ', course ? `${course.name} (versions=${JSON.stringify(course.versions)})` : 'NOT FOUND');
  console.log('Version: ', version ? `status=${version.versionStatus}, autoApprove=${version.autoApprove}` : 'NOT FOUND');

  await client.close();
})().catch(e => { console.error('ERR: ' + e.message); console.error(e); process.exit(1); });
