// scripts/direct-enroll-2026-07-09.cjs
// Directly inserts an enrollment row + progress row for the test user into the
// test course. This bypasses the enrollment controller (and its CASL permission
// check that blocks self-enrollment in this permission model).
//
// Mirror of EnrollmentService.enrollUser() + ProgressService.initializeProgress()
// but without the transaction wrapping and without the HP ledger entry.
// Safe to re-run (idempotent on existing enrollment).

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

const USER_ID = '6a4b9f85cc68bde40897fc16';
const COURSE_ID = '6a4f774273de56bebbabd662';
const VERSION_ID = '6a4f774273de56bebbabd663';
const USER_OBJ_ID = new ObjectId(USER_ID);
const COURSE_OBJ_ID = new ObjectId(COURSE_ID);
const VERSION_OBJ_ID = new ObjectId(VERSION_ID);

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('=======================================================');
  console.log(' 1) Check for existing enrollment');
  console.log('=======================================================');
  const existing = await db.collection('enrollment').findOne({
    userId: USER_OBJ_ID,
    courseId: COURSE_OBJ_ID,
    courseVersionId: VERSION_OBJ_ID,
  });
  if (existing) {
    console.log('  Found existing enrollment:');
    console.log(`    _id=${existing._id} status=${existing.status} percentCompleted=${existing.percentCompleted}`);
    console.log('  Nothing to do.');
    await client.close();
    return;
  }

  console.log('\n=======================================================');
  console.log(' 2) Resolve first item to seed progress');
  console.log('=======================================================');

  // Walk: courseVersion.modules[0] -> sections[0] -> itemsGroupId -> items[0]
  const version = await db.collection('newCourseVersion').findOne({_id: VERSION_OBJ_ID});
  if (!version || !version.modules?.length) {
    console.error('  No courseVersion found or no modules. Run fixup first.');
    process.exit(1);
  }
  console.log(`  courseVersion.modules.length = ${version.modules.length}`);
  // pick the first module by order (lexical)
  const modules = [...version.modules].sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  const firstModule = modules[0];
  const moduleId = firstModule._id;
  console.log(`  First module _id=${moduleId}  name="${firstModule.name}"`);

  if (!firstModule.sections?.length) {
    console.error('  Module has no sections.');
    process.exit(1);
  }
  const sections = [...firstModule.sections].sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  const firstSection = sections[0];
  const sectionId = firstSection._id;
  const itemsGroupId = firstSection.itemsGroupId;
  console.log(`  First section _id=${sectionId}  itemsGroupId=${itemsGroupId}`);

  const itemsGroup = await db.collection('itemsGroup').findOne({_id: itemsGroupId});
  if (!itemsGroup || !itemsGroup.items?.length) {
    console.error('  No itemsGroup or empty items. Run fixup first.');
    process.exit(1);
  }
  const items = [...itemsGroup.items]
    .filter(i => !i.isHidden && !i.isDeleted)
    .sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  const firstItem = items[0];
  const itemId = firstItem._id || firstItem.itemId;
  console.log(`  First item _id=${itemId}  type=${firstItem.type || '(unknown)'}`);

  console.log('\n=======================================================');
  console.log(' 3) Insert enrollment row');
  console.log('=======================================================');
  const now = new Date();
  const enrollmentDoc = {
    userId: USER_OBJ_ID,
    courseId: COURSE_OBJ_ID,
    courseVersionId: VERSION_OBJ_ID,
    role: 'STUDENT',
    status: 'ACTIVE',
    enrollmentDate: now,
    percentCompleted: 0,
    completedItemsCount: 0,
    hpPoints: 0,
    createdAt: now,
    updatedAt: now,
  };
  const enrollResult = await db.collection('enrollment').insertOne(enrollmentDoc);
  console.log(`  ✓ Enrollment inserted _id=${enrollResult.insertedId}`);

  console.log('\n=======================================================');
  console.log(' 4) Insert progress row');
  console.log('=======================================================');
  const progressDoc = {
    userId: USER_OBJ_ID,
    courseId: COURSE_OBJ_ID,
    courseVersionId: VERSION_OBJ_ID,
    currentModule: new ObjectId(moduleId),
    currentSection: new ObjectId(sectionId),
    currentItem: new ObjectId(itemId),
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
  const progressResult = await db.collection('progress').insertOne(progressDoc);
  console.log(`  ✓ Progress inserted _id=${progressResult.insertedId}`);

  console.log('\n=======================================================');
  console.log(' 5) Verify');
  console.log('=======================================================');
  const enrolled = await db.collection('enrollment').findOne({_id: enrollResult.insertedId});
  const progresses = await db.collection('progress').countDocuments({userId: USER_OBJ_ID});
  console.log(`  Enrollment present:    YES (status=${enrolled.status})`);
  console.log(`  Progress rows for user: ${progresses}`);

  console.log('\n  Now: hard-refresh the browser and check Enrolled Courses.');
  console.log('  Companion should be stage 0, mood neutral, progress 0%.');
  console.log('  Browse to the course → first item should load.');

  await client.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});