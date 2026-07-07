// scripts/seed-test-course.js
// Seeds a minimal public course so the user can:
//   1. See it in /api/courses/public
//   2. Enroll via POST /api/users/:userId/enrollments/courses/:courseId/versions/:versionId
//   3. See the companion grow via percentCompleted + quiz_submission_results
//
// Schema references (verified by reading backend code 2026-07-07):
//   - newCourse:            {_id, name, description, versions[], instructors[], createdAt, updatedAt, isDeleted}
//   - newCourseVersion:     {_id, courseId, versionStatus, ...}
//   - courseSettings:       {_id, courseId, courseVersionId, settings: {isPublic, linearProgressionEnabled, ...}}
//   - itemsGroup:           {_id, sectionId, items: [{itemId, type, order, name}]}
//   - items:                {_id, name, type, ...}
//   - enrollment:           {userId, courseId, courseVersionId, role, status, enrollmentDate, percentCompleted, completedItemsCount}
//   - quiz_submission_results: {userId, quizId, cohortId, gradingResult: {totalScore, totalMaxScore}}
//
// Collections used by the public course listing (getPublicCourses aggregate):
//   match  courseSettings where settings.isPublic: true
//   lookup newCourse by courseId (must NOT be isDeleted: true)
//   lookup newCourseVersion by courseVersionId (must NOT be versionStatus: 'archived')
//
// Collection used by companion:
//   enrollment (filter: percentCompleted < 100, take MAX)
//   quiz_submission_results (avg gradingResult.totalScore)

const {MongoClient, ObjectId} = require('mongodb');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

// Sahasra's actual Mongo _id (from previous session)
const USER_ID = '6a4b9f85cc68bde40897fc16';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // Idempotency: clean up any prior seed of this exact test course so we can re-run
  console.log('[seed] Cleaning prior test course artifacts…');
  const existing = await db.collection('newCourse').findOne({name: 'Test Drive: Companion Demo'});
  if (existing) {
    const courseId = existing._id;
    const versions = await db.collection('newCourseVersion').find({courseId}).toArray();
    const versionIds = versions.map(v => v._id);
    await db.collection('courseSettings').deleteMany({courseId});
    await db.collection('enrollment').deleteMany({courseId});
    // find items groups that point to sections under our versions
    const sections = await db.collection('newSection').find({courseVersionId: {$in: versionIds}}).toArray();
    const sectionIds = sections.map(s => s._id);
    const groups = await db.collection('itemsGroup').find({sectionId: {$in: sectionIds}}).toArray();
    const groupIds = groups.map(g => g._id);
    const itemRefs = groups.flatMap(g => g.items || []);
    const itemIds = itemRefs.map(i => new ObjectId(i.itemId));
    await db.collection('itemsGroup').deleteMany({_id: {$in: groupIds}});
    await db.collection('items').deleteMany({_id: {$in: itemIds}});
    await db.collection('newSection').deleteMany({_id: {$in: sectionIds}});
    await db.collection('newCourseVersion').deleteMany({courseId});
    await db.collection('newCourse').deleteOne({_id: courseId});
    console.log(`[seed] Cleaned course ${courseId} and ${versions.length} version(s)`);
  }

  // Build IDs deterministically (so the user can re-run safely and so logs are readable)
  const courseId = new ObjectId();
  const versionId = new ObjectId();
  const section1Id = new ObjectId();
  const section2Id = new ObjectId();
  const itemGroup1Id = new ObjectId();   // for section 1: video item
  const itemGroup2Id = new ObjectId();   // for section 2: quiz item
  const videoItemId = new ObjectId();
  const quizItemId = new ObjectId();
  const quizId = new ObjectId();         // for quiz_submission_results.quizId

  const now = new Date();

  // 1) Course
  await db.collection('newCourse').insertOne({
    _id: courseId,
    name: 'Test Drive: Companion Demo',
    description: 'A tiny public course used to demo the companion growth logic. Two short sections: a video and a quiz.',
    categories: ['demo', 'companion'],
    versions: [versionId],
    instructors: [],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[seed] Created newCourse _id=${courseId}`);

  // 2) Course version
  await db.collection('newCourseVersion').insertOne({
    _id: versionId,
    courseId,
    version: 1,
    name: 'v1',
    description: 'Default version',
    versionStatus: 'active',  // anything other than 'archived'
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[seed] Created newCourseVersion _id=${versionId}`);

  // 3) Course settings (THIS is what makes it public-visible)
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
  console.log(`[seed] Created courseSettings with settings.isPublic=true`);

  // 4) Sections (2 sections → 1 module with 2 sections would be the typical shape, but
  //    the public listing doesn't depend on this, and the companion doesn't read it.
  //    Skipping newSection for now; itemsGroups can exist without a section in our minimal seed.)
  //    If the frontend needs sections to render the course player, we'll add them later.

  // 5) Items: one VIDEO, one QUIZ
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
      name: 'Quick check quiz (3 questions)',
      type: 'QUIZ',
      description: 'Three-question quiz on the video content.',
      createdAt: now,
      updatedAt: now,
    },
  ]);
  console.log(`[seed] Created 2 items: video=${videoItemId}, quiz=${quizItemId}`);

  // 6) Items groups (per the schema, itemsGroups link items to sections)
  await db.collection('itemsGroup').insertMany([
    {
      _id: itemGroup1Id,
      sectionId: section1Id,
      items: [{itemId: videoItemId.toString(), type: 'VIDEO', order: 1, name: 'Welcome video (1 min)'}],
    },
    {
      _id: itemGroup2Id,
      sectionId: section2Id,
      items: [{itemId: quizItemId.toString(), type: 'QUIZ', order: 2, name: 'Quick check quiz (3 questions)'}],
    },
  ]);
  console.log(`[seed] Created 2 itemsGroups`);

  // 7) Quiz doc (collection name = ?). Try 'quizzes' first, will check.
  const quizColl = db.collection('quizzes');
  const existingQuizzesColl = await db.listCollections({name: 'quizzes'}).toArray();
  if (existingQuizzesColl.length === 0) {
    console.log('[seed] NOTE: no "quizzes" collection exists; the companion does not need a quiz doc to derive quiz score, but you may want to create one if the UI expects it.');
  } else {
    await quizColl.insertOne({
      _id: quizId,
      itemId: quizItemId,
      title: 'Quick check quiz',
      questions: [
        {_id: new ObjectId(), text: 'Question 1: What is the companion\'s purpose?', type: 'MCQ'},
        {_id: new ObjectId(), text: 'Question 2: Name one growth stage trigger.', type: 'MCQ'},
        {_id: new ObjectId(), text: 'Question 3: When does mood flip to "happy"?', type: 'MCQ'},
      ],
      createdAt: now,
    });
    console.log(`[seed] Created quiz doc`);
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('✅ Seed complete.');
  console.log('────────────────────────────────────────────────────────────');
  console.log(`courseId         = ${courseId}`);
  console.log(`courseVersionId  = ${versionId}`);
  console.log(`videoItemId      = ${videoItemId}`);
  console.log(`quizItemId       = ${quizItemId}`);
  console.log(`userId           = ${USER_ID}`);
  console.log('');
  console.log('Now the course will show up in GET /api/courses/public.');
  console.log('Enroll via: POST /api/users/' + USER_ID + '/enrollments/courses/' + courseId + '/versions/' + versionId);
  console.log('────────────────────────────────────────────────────────────');

  // Also write a state file so the bump script can read IDs without re-querying
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'scripts', '.seed-state.json'),
    JSON.stringify({courseId: courseId.toString(), courseVersionId: versionId.toString(), videoItemId: videoItemId.toString(), quizItemId: quizItemId.toString(), userId: USER_ID}, null, 2),
  );

  await client.close();
})().catch(err => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
