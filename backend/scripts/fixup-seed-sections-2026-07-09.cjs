// scripts/fixup-seed-sections-2026-07-09.cjs
// Patch the previously-seeded test course so that:
//   1) A newModule row exists for the course version
//   2) Two newSection rows exist, one per itemsGroup
//   3) newCourseVersion.modules[] is populated with the module + sections
//   4) itemsGroup rows are kept (already exist) and now have a real section backing them
//
// Why: the POST /api/course/registration/version/:versionId handler calls
// CourseVersionService.sortItemsByOrder with a section->itemsGroup lookup chain.
// If newSection rows are missing, the chain returns undefined for `items`, and
// `items is not iterable` is thrown (TypeError at line 132 of CourseVersionService.js).
//
// Idempotent: re-running does not create duplicates. It patches the existing seed.
const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // Locate the test course
  const course = await db.collection('newCourse').findOne({name: 'Test Drive: Companion Demo'});
  if (!course) {
    console.error('[fixup] No test course found. Run seed-test-course.cjs first.');
    process.exit(1);
  }
  const courseId = course._id;
  const version = await db.collection('newCourseVersion').findOne({courseId});
  if (!version) {
    console.error('[fixup] No version found for course. Run seed-test-course.cjs first.');
    process.exit(1);
  }
  const versionId = version._id;

  console.log(`[fixup] Patching course=${courseId} version=${versionId}`);

  // The seed wrote 2 itemsGroups, both pointing to phantom section IDs.
  // The itemsGroup.sectionId is a string in the existing seed, so we need to
  // match by string. Let's read the current itemsGroups and treat their
  // sectionId values as the *intended* section _id values we must now create.
  const groups = await db.collection('itemsGroup').find({}).toArray();
  if (groups.length === 0) {
    console.error('[fixup] No itemsGroups found. Run seed-test-course.cjs first.');
    process.exit(1);
  }
  console.log(`[fixup] Found ${groups.length} itemsGroup(s) to attach sections to`);

  // We treat the itemsGroup as the source of truth: each group already has a
  // `sectionId` (possibly a phantom ObjectId) — we'll use that as the section's _id.
  // For each itemsGroup, upsert a matching newSection with the same _id.
  const now = new Date();
  const sections = [];
  for (const g of groups) {
    if (!g.sectionId) {
      console.warn(`[fixup] itemsGroup ${g._id} has no sectionId; assigning a fresh one`);
      g.sectionId = new ObjectId();
      await db.collection('itemsGroup').updateOne({_id: g._id}, {$set: {sectionId: g.sectionId}});
    }
    const sectionId = typeof g.sectionId === 'string'
      ? new ObjectId(g.sectionId)
      : g.sectionId;

    const sectionDoc = {
      _id: sectionId,
      name: `Section for ${(g.items?.[0]?.name) || 'items'}`,
      description: 'Auto-created by seed fixup 2026-07-09',
      order: `0|hzzzzz:${sections.length.toString().padStart(6, '0')}`,
      itemsGroupId: g._id,
      createdAt: g.createdAt || now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
      isHidden: false,
    };
    await db.collection('newSection').updateOne(
      {_id: sectionDoc._id},
      {$set: sectionDoc},
      {upsert: true},
    );
    sections.push(sectionDoc);
    console.log(`[fixup]   newSection _id=${sectionId}  itemsGroupId=${g._id}`);
  }

  // Create (or reuse) a newModule that contains both sections.
  // Match by courseVersionId so re-runs don't duplicate modules.
  let moduleDoc = await db.collection('newModule').findOne({courseVersionId: versionId});
  if (!moduleDoc) {
    const moduleId = new ObjectId();
    moduleDoc = {
      _id: moduleId,
      courseVersionId: versionId,
      courseId,
      name: 'Module 1: Welcome and Check',
      description: 'Auto-created by seed fixup 2026-07-09',
      order: '0|hzzzzz:',
      sections: sections.map(s => ({
        _id: s._id,
        name: s.name,
        description: s.description,
        order: s.order,
        itemsGroupId: s.itemsGroupId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      isHidden: false,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('newModule').insertOne(moduleDoc);
    console.log(`[fixup] Created newModule _id=${moduleId} with ${sections.length} section(s)`);
  } else {
    // Re-sync the sections array in case the itemsGroups changed
    await db.collection('newModule').updateOne(
      {_id: moduleDoc._id},
      {$set: {
        sections: sections.map(s => ({
          _id: s._id,
          name: s.name,
          description: s.description,
          order: s.order,
          itemsGroupId: s.itemsGroupId,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        updatedAt: now,
      }},
    );
    console.log(`[fixup] Reused newModule _id=${moduleDoc._id}, re-synced ${sections.length} section(s)`);
  }

  // Populate newCourseVersion.modules[] (denormalized, populated by the create flow
  // at runtime — but the registration handler reads it back, so we seed it).
  await db.collection('newCourseVersion').updateOne(
    {_id: versionId},
    {$set: {
      modules: [{
        _id: moduleDoc._id,
        name: moduleDoc.name,
        description: moduleDoc.description,
        order: moduleDoc.order,
        sections: moduleDoc.sections,
        isHidden: false,
        createdAt: moduleDoc.createdAt,
        updatedAt: moduleDoc.updatedAt,
      }],
      updatedAt: now,
    }},
  );
  console.log(`[fixup] Updated newCourseVersion.modules[]`);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' AFTER fixup');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`newSection count:       ${await db.collection('newSection').countDocuments({})}`);
  console.log(`newModule count:        ${await db.collection('newModule').countDocuments({})}`);
  console.log(`itemsGroup count:       ${await db.collection('itemsGroup').countDocuments({})}`);
  console.log(`newCourseVersion.modules array length: ${(await db.collection('newCourseVersion').findOne({_id: versionId})).modules.length}`);

  await client.close();
  console.log('\n✅ Fixup complete. Try the registration POST again.');
})().catch(err => {
  console.error('[fixup] FAILED:', err);
  process.exit(1);
});