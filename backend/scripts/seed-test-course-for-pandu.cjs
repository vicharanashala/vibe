// scripts/seed-test-course-for-pandu.cjs
//
// One-shot: seed a minimal PUBLIC test course so pandu (or any student)
// can enroll via the browser, then we observe the companion's
// stage/mood update in response to real progress.
//
// Does NOT pre-set percentCompleted, does NOT pre-create an enrollment,
// does NOT pre-fill quiz_submission_results. Those must come from the
// learner's actual activity so we can verify the growth loop.
//
// Run: node backend/scripts/seed-test-course-for-pandu.cjs
//
// What it seeds (collection names verified in
// backend/src/shared/database/providers/mongo/repositories/EnrollmentRepository.ts):
//   - newCourse            "Test Drive: Companion Demo"
//   - newCourseVersion     active, 1 module, 1 section, 1 itemsGroup
//   - newModule            "Module 1: Welcome"
//   - newSection           "Section 1: Watch + Quiz"
//   - courseSettings       settings.isPublic = true   ← /api/courses/public
//   - itemsGroup           with 1 VIDEO + 1 QUIZ item
//   - items                the video + the quiz (both now have itemDetails)
//   - quizzes              1 quiz
//   - questionBanks        1 SOL question (3 options)
//
// After running:
//   1. Refresh the browser at http://127.0.0.1:5173
//   2. Open companion widget — confirm baseline stage 0 / mood=neutral
//   3. Go to course catalog — "Test Drive: Companion Demo" should appear
//   4. Enroll → still stage 0 (no progress yet)
//   5. Watch the video + mark complete → /api/enrollments/.../progress
//      should fire and recompute percentCompleted
//   6. Take the quiz + submit → quiz_submission_results row appears,
//      quiz score feeds into companion growth
//   7. Re-open companion widget — stage/mood should have moved

const {MongoClient, ObjectId} = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const STATE_PATH = path.join(__dirname, '..', '..', 'scripts', '.seed-state.json');

function log(...args) { console.log('[seed]', ...args); }
function fail(msg) { console.error('[seed] FAILED:', msg); process.exit(1); }

(async () => {
  log('Connecting to Mongo…');
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // ── 1. Clean any prior seed of this exact course name ───────────────────
  log('Cleaning prior seed (if any)…');
  const existing = await db.collection('newCourse').findOne({name: 'Test Drive: Companion Demo'});
  if (existing) {
    const cId = existing._id;
    const versions = await db.collection('newCourseVersion').find({courseId: cId}).toArray();
    const versionIds = versions.map(v => v._id);
    const sections = await db.collection('newSection').find({courseVersionId: {$in: versionIds}}).toArray();
    const sectionIds = sections.map(s => s._id);
    const groups = await db.collection('itemsGroup').find({sectionId: {$in: sectionIds}}).toArray();
    const groupIds = groups.map(g => g._id);
    const itemRefs = groups.flatMap(g => g.items || []);
    const itemIds = itemRefs.map(i => new ObjectId(i.itemId));

    // Look up the version's moduleIds from the embedded modules array
    const moduleIds = versions.flatMap(v =>
      (v.modules || []).map(m => new ObjectId(m.moduleId)),
    );

    // Find the user this course was listed under (best effort)
    const course = await db.collection('newCourse').findOne({_id: cId});
    const instructorIds = (course && course.instructors) || [];

    // Drop everything in the right order
    await db.collection('courseSettings').deleteMany({courseId: cId});
    await db.collection('itemsGroup').deleteMany({_id: {$in: groupIds}});
    await db.collection('items').deleteMany({_id: {$in: itemIds}});
    await db.collection('newSection').deleteMany({_id: {$in: sectionIds}});
    await db.collection('newModule').deleteMany({_id: {$in: moduleIds}});
    await db.collection('newCourseVersion').deleteMany({courseId: cId});
    await db.collection('newCourse').deleteOne({_id: cId});
    log(`  Cleaned prior course ${cId} (${itemIds.length} items, ${sectionIds.length} sections, ${moduleIds.length} modules)`);

    // Don't delete users
    void instructorIds;
  }

  // ── 2. Build IDs deterministically ──────────────────────────────────────
  const courseId = new ObjectId();
  const versionId = new ObjectId();
  const moduleId = new ObjectId();
  const sectionId = new ObjectId();
  const itemsGroupId = new ObjectId();
  const videoItemId = new ObjectId();
  const quizItemId = new ObjectId();
  const quizId = new ObjectId();
  const questionId = new ObjectId();
  const lotId = new ObjectId();
  const correctOptionId = new ObjectId();
  const now = new Date();

  // ── 3. Insert course structure ──────────────────────────────────────────
  log('Seeding course structure…');

  await db.collection('newCourse').insertOne({
    _id: courseId,
    name: 'Test Drive: Companion Demo',
    description:
      'A tiny public course used to observe the companion growth loop in real time. One short video and a one-question quiz.',
    categories: ['demo', 'companion'],
    versions: [versionId],
    instructors: [],         // empty — frontend's public listing tolerates this
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('newModule').insertOne({
    _id: moduleId,
    courseId,
    courseVersionId: versionId,
    name: 'Module 1: Welcome',
    description: 'Single module of the demo course.',
    order: '1',
    isHidden: false,
    sectionIds: [sectionId],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('newSection').insertOne({
    _id: sectionId,
    courseId,
    courseVersionId: versionId,
    moduleId,
    name: 'Section 1: Watch + Quiz',
    description: 'One video, then a one-question quiz.',
    order: '1',
    isHidden: false,
    itemsGroupId,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Course version — modules are referenced both embedded AND via newModule
  await db.collection('newCourseVersion').insertOne({
    _id: versionId,
    courseId,
    version: 1,
    name: 'v1',
    description: 'Default version of the demo course.',
    versionStatus: 'active',
    modules: [
      {
        moduleId,
        name: 'Module 1: Welcome',
        order: '1',
        isHidden: false,
        sections: [
          {
            sectionId,
            itemsGroupId,
            name: 'Section 1: Watch + Quiz',
            order: '1',
            isHidden: false,
          },
        ],
      },
    ],
    totalItems: 2,
    itemCounts: {VIDEO: 1, QUIZ: 1, BLOG: 0, PROJECT: 0, FEEDBACK: 0},
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Course settings — IS_PUBLIC is what makes /api/courses/public list it
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

  // ── 4. Insert items with full itemDetails ────────────────────────────────
  //
  // IBaseItem schema (backend/src/shared/interfaces/models.ts):
  //   { itemId, name, description, type, order, itemDetails }
  //
  // IVideoDetails:  { URL: string, startTime: string, endTime: string, points: number }
  // IQuizDetails:   { questionBankRefs, passThreshold, maxAttempts, quizType,
  //                   releaseTime, questionVisibility, deadline,
  //                   approximateTimeToComplete, allowPartialGrading, allowHint,
  //                   showCorrectAnswersAfterSubmission, showExplanationAfterSubmission,
  //                   showScoreAfterSubmission, allowSkip }
  await db.collection('items').insertMany([
    {
      _id: videoItemId,
      itemId: videoItemId.toString(),
      name: 'Welcome to your companion',
      type: 'VIDEO',
      description: 'A short intro video about the Digital Learning Companion.',
      order: '1',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      // itemDetails matches IVideoDetails
      itemDetails: {
        URL: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        startTime: '0',
        endTime: '212',      // full video length; seekForwardEnabled=true in course settings
        points: 100,
      },
    },
    {
      _id: quizItemId,
      itemId: quizItemId.toString(),
      name: 'Companion quick check',
      type: 'QUIZ',
      description: 'One SOL question on how the companion grows.',
      order: '2',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      // itemDetails matches IQuizDetails
      itemDetails: {
        questionBankRefs: [
          {
            bankId: questionId.toString(),
            count: 1,
          },
        ],
        passThreshold: 0,         // any score passes
        maxAttempts: 3,
        quizType: 'NO_DEADLINE',
        releaseTime: now,
        questionVisibility: 1,
        approximateTimeToComplete: '00:05:00',
        allowPartialGrading: false,
        allowHint: false,
        showCorrectAnswersAfterSubmission: true,
        showExplanationAfterSubmission: true,
        showScoreAfterSubmission: true,
        allowSkip: false,
      },
    },
  ]);

  await db.collection('itemsGroup').insertOne({
    _id: itemsGroupId,
    sectionId,
    items: [
      {itemId: videoItemId.toString(), type: 'VIDEO', order: 1, name: 'Welcome to your companion', _id: videoItemId},
      {itemId: quizItemId.toString(),  type: 'QUIZ',  order: 2, name: 'Companion quick check',     _id: quizItemId},
    ],
    isHidden: false,
    createdAt: now,
    updatedAt: now,
  });

  // ── 5. Insert quiz + question bank ───────────────────────────────────────
  await db.collection('quizzes').insertOne({
    _id: quizId,
    itemId: quizItemId.toString(),
    title: 'Companion quick check',
    description: 'One SOL question to verify quiz scoring feeds the companion loop.',
    questions: [questionId.toString()],
    createdAt: now,
    updatedAt: now,
  });

  // questionBanks document — ISOLQuestion shape (models.ts IQuestion + ISOLQuestion)
  await db.collection('questionBanks').insertOne({
    _id: questionId,
    quizId: quizId.toString(),
    questionText: 'What makes the companion\'s stage move?',
    questionType: 'SOL',
    parameterized: false,
    hintText: 'Think about real progress signals.',
    timeLimit: 60,
    points: 100,
    priority: 'MEDIUM',
    metaDetails: {
      _id: new ObjectId().toString(),
      creatorId: null,
      isStudentGenerated: false,
      isAIGenerated: false,
    },
    lot: {
      _id: lotId,
      lotItems: [
        {
          _id: correctOptionId,
          itemText: 'Completing course content and quiz scores',
          explaination: 'percentCompleted and quiz_submission_results drive the growth loop.',
        },
        {
          _id: new ObjectId(),
          itemText: 'Visiting the dashboard every day',
          explaination: '',
        },
        {
          _id: new ObjectId(),
          itemText: 'Sending messages to the instructor',
          explaination: '',
        },
      ],
    },
    solution: {lotItemId: correctOptionId.toString()},
    createdAt: now,
    updatedAt: now,
  });

  log(`  newCourse         ${courseId}`);
  log(`  newCourseVersion  ${versionId}`);
  log(`  courseSettings    isPublic=true`);
  log(`  itemsGroup        ${itemsGroupId}`);
  log(`  items             video=${videoItemId}  quiz=${quizItemId}`);
  log(`                    video itemDetails.URL = https://www.youtube.com/embed/dQw4w9WgXcQ`);
  log(`                    quiz  itemDetails.questionBankRefs[0].bankId = ${questionId}`);
  log(`  quizzes           ${quizId}  (1 SOL question)`);
  log(`  questionBanks     ${questionId}  (lot with 3 options, correctOptionId=${correctOptionId})`);

  // ── 6. Save state file for reference ────────────────────────────────────
  const state = {
    courseId: courseId.toString(),
    courseVersionId: versionId.toString(),
    moduleId: moduleId.toString(),
    sectionId: sectionId.toString(),
    itemsGroupId: itemsGroupId.toString(),
    videoItemId: videoItemId.toString(),
    quizItemId: quizItemId.toString(),
    quizId: quizId.toString(),
    questionId: questionId.toString(),
    correctOptionId: correctOptionId.toString(),
  };
  fs.mkdirSync(path.dirname(STATE_PATH), {recursive: true});
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  log(`Wrote state file: ${STATE_PATH}`);

  await client.close();

  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('  Course seeded. Now drive progress through the browser:');
  log('');
  log('  1. Refresh http://127.0.0.1:5173');
  log('  2. Open the companion widget — confirm baseline stage=0/mood=neutral');
  log('  3. Open course catalog — "Test Drive: Companion Demo" should appear');
  log('  4. Enroll');
  log('  5. Watch the video → mark complete');
  log('  6. Take the quiz → submit (correct answer: "Completing course content and quiz scores")');
  log('  7. Re-check companion widget — does stage/mood change?');
  log('═══════════════════════════════════════════════════════════════');

  process.exit(0);
})().catch(err => fail(err && err.stack ? err.stack : err));