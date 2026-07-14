// scripts/fixup-course-structure.cjs
//
// Patches the most recent "Test Drive: Companion Demo" seed so that:
//   1. newSection records exist for every sectionId referenced by an itemsGroup
//   2. newCourseVersion has a modules[] entry pointing at those sections
//   3. videos and quizzes typed collections have rows for the items
//   4. quiz details has questionBankRefs + quizType:'DEADLINE' so Quiz.tsx renders
//
// Idempotent — re-running does not duplicate or break existing data.

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const COURSE_NAME = 'Test Drive: Companion Demo';
const YOUTUBE_VIDEO_URL = 'M7lc1UVf-VE';  // YouTube IFrame API demo

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const now = new Date();

  // 1) Find the most recent course with our test name
  const course = await db.collection('newCourse').findOne(
    { name: COURSE_NAME },
    { sort: { createdAt: -1 } },
  );
  if (!course) {
    console.error('[fixup] No course with name "' + COURSE_NAME + '" found. Run seed-test-course.cjs first.');
    process.exit(1);
  }
  const courseId = course._id;
  console.log('[fixup] Course _id=' + courseId);

  // 2) Find course version
  const version = await db.collection('newCourseVersion').findOne({ courseId });
  if (!version) {
    console.error('[fixup] No version for course ' + courseId);
    process.exit(1);
  }
  const versionId = version._id;
  console.log('[fixup] Version _id=' + versionId + ' (versionStatus=' + version.versionStatus + ')');

  // 3) Find items + itemsGroups for this version
  //    itemsGroups reference sections, but those sections need to exist for the
  //    frontend course player to render. We add them if missing.
  const groups = await db.collection('itemsGroup').find({}).toArray();
  console.log('[fixup] Found ' + groups.length + ' itemsGroups');

  // Pull sectionIds referenced by the itemsGroups
  const sectionIds = [...new Set(groups.map(g => g.sectionId).filter(Boolean))];
  console.log('[fixup] itemsGroups reference ' + sectionIds.length + ' sectionIds');

  // Ensure each sectionId has a newSection record
  let sectionsCreated = 0;
  let sectionsExisting = 0;
  for (const sectionId of sectionIds) {
    if (!sectionId) continue;
    const sid = sectionId instanceof ObjectId ? sectionId : new ObjectId(sectionId);
    const existing = await db.collection('newSection').findOne({ _id: sid });
    if (existing) {
      sectionsExisting++;
      continue;
    }
    await db.collection('newSection').insertOne({
      _id: sid,
      courseVersionId: versionId,
      name: 'Section ' + (sectionsExisting + sectionsCreated + 1),
      description: 'Auto-created by fixup-course-structure.cjs',
      order: String(sectionsExisting + sectionsCreated + 1),
      isHidden: false,
      itemsGroupId: null,  // patched below
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
    sectionsCreated++;
  }
  console.log('[fixup] Sections — existing=' + sectionsExisting + ', created=' + sectionsCreated);

  // 4) Update each section's itemsGroupId now that we have all sections
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const sectionId = g.sectionId instanceof ObjectId ? g.sectionId : new ObjectId(g.sectionId);
    await db.collection('newSection').updateOne(
      { _id: sectionId },
      { $set: { itemsGroupId: g._id } },
    );
  }
  console.log('[fixup] Wired itemsGroupId on each newSection');

  // 5) Add modules[] to the version if missing or empty
  //    Module structure: { moduleId, sections: [{ sectionId, order, isHidden }] }
  if (!Array.isArray(version.modules) || version.modules.length === 0) {
    const moduleId = new ObjectId();
    const moduleSections = sectionIds.map((sid, idx) => {
      const sectionId = sid instanceof ObjectId ? sid : new ObjectId(sid);
      return {
        sectionId,
        order: String(idx + 1),
        isHidden: false,
        itemsGroupId: groups.find(g => {
          const gsid = g.sectionId instanceof ObjectId ? g.sectionId : new ObjectId(g.sectionId);
          return gsid.equals(sectionId);
        })?._id ?? null,
      };
    });
    await db.collection('newCourseVersion').updateOne(
      { _id: versionId },
      { $set: { modules: [{ moduleId, name: 'Demo module', description: 'Auto-created', order: '1', isHidden: false, sections: moduleSections }] } },
    );
    console.log('[fixup] Added modules[] with ' + moduleSections.length + ' sections to version ' + versionId);
  } else {
    console.log('[fixup] Version already has modules[] (count=' + version.modules.length + '), leaving alone');
  }

  // 6) Add typed videos + quizzes rows for each item
  const items = await db.collection('items').find({}).toArray();
  console.log('[fixup] Found ' + items.length + ' items');

  for (const item of items) {
    if (item.type === 'VIDEO') {
      const existing = await db.collection('videos').findOne({ _id: item._id });
      if (!existing) {
        await db.collection('videos').insertOne({
          _id: item._id,
          name: item.name,
          description: item.description,
          URL: YOUTUBE_VIDEO_URL,
          startTime: 0,
          endTime: 60,  // 1 minute
          points: 10,
          createdAt: now,
          updatedAt: now,
        });
        console.log('[fixup] Created typed video _id=' + item._id);
      }
    } else if (item.type === 'QUIZ') {
      const existing = await db.collection('quizzes').findOne({ _id: item._id });
      if (!existing) {
        await db.collection('quizzes').insertOne({
          _id: item._id,
          name: item.name,
          description: item.description,
          details: {
            questionBankRefs: [],  // will be patched below if questionBanks exist
            passThreshold: 0.5,
            maxAttempts: -1,
            quizType: 'DEADLINE',
            releaseTime: new Date(Date.now() - 86_400_000),  // yesterday
            questionVisibility: 1,
            approximateTimeToComplete: '00:05:00',
            allowPartialGrading: true,
            allowHint: true,
            showCorrectAnswersAfterSubmission: true,
            showExplanationAfterSubmission: true,
            showScoreAfterSubmission: true,
            allowSkip: false,
          },
          createdAt: now,
          updatedAt: now,
        });
        console.log('[fixup] Created typed quiz _id=' + item._id);
      }
    }
  }

  // 7) Create a questionBanks + questions doc and wire it into the quiz details
  const quizItems = items.filter(i => i.type === 'QUIZ');
  if (quizItems.length > 0) {
    const questionBankId = new ObjectId();
    const questionId = new ObjectId();
    await db.collection('questionBanks').updateOne(
      { _id: questionBankId },
      {
        $set: {
          _id: questionBankId,
          name: 'Demo Question Bank',
          description: 'Auto-created by fixup',
          questions: [questionId],
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    await db.collection('questions').updateOne(
      { _id: questionId },
      {
        $set: {
          _id: questionId,
          questionText: "What is ViBe's companion's animal?",
          questionType: 'SOL',
          parameterized: false,
          hintText: 'It is one of: Panda, Fox, Lion, Tiger.',
          timeLimit: 60,
          points: 10,
          priority: 'MEDIUM',
          metaDetails: { creatorId: null, isStudentGenerated: false, isAIGenerated: false },
          lot: {
            _id: new ObjectId(),
            lotItems: [
              { _id: new ObjectId(), itemText: 'Panda', explaination: 'Wrong.' },
              { _id: new ObjectId(), itemText: 'Fox', explaination: 'Correct!' },
              { _id: new ObjectId(), itemText: 'Lion', explaination: 'Wrong.' },
              { _id: new ObjectId(), itemText: 'Tiger', explaination: 'Wrong.' },
            ],
          },
          solution: { correctLotItem: { lotItemId: null } },  // patched below
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    // Patch solution.lotItemId to point at the "Fox" lot item
    const lotItems = await db.collection('questions').findOne({ _id: questionId });
    const foxItem = lotItems.lot.lotItems.find(li => li.itemText === 'Fox');
    if (foxItem) {
      await db.collection('questions').updateOne(
        { _id: questionId },
        { $set: { 'solution.correctLotItem': { lotItemId: foxItem._id, order: 1 } } },
      );
    }

    // Wire questionBankRefs into each quiz's details
    for (const quiz of quizItems) {
      await db.collection('quizzes').updateOne(
        { _id: quiz._id },
        { $set: { 'details.questionBankRefs': [{ bankId: questionBankId, count: 1 }] } },
      );
      console.log('[fixup] Wired questionBankRefs into quiz ' + quiz._id);
    }
    console.log('[fixup] Created questionBanks _id=' + questionBankId + ' with question _id=' + questionId);
  }

  console.log('\n[fixup] Done. Now hard-refresh the course page and try enrolling.');
  await client.close();
})().catch(err => {
  console.error('[fixup] FAILED:', err);
  process.exit(1);
});