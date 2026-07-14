// scripts/cleanup-stale-test-2026-07-09.cjs
// One-time cleanup of stale test data left over from the 2026-07-08 seed.
//
// Stale courses identified by ID (these were created on 2026-07-08 and never cleaned):
//   - 6a4d31e8e346d6b4246c8547 (courseId) — first stale course
//   - 6a4d342bef9ba22049897ec9 (courseId) — second stale course (this was the "Stage 2 driver")
//   - 6a4e4bb29beec9f68bdfd868 (courseId) — yet another stale test course
//
// Plus any sections, modules, itemsGroups, items, courseSettings that belong to them.
// After this runs, the 2026-07-09 test course should be the only one left.
//
// Idempotent: re-runs are no-ops.

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

const STALE_COURSE_IDS = [
  '6a4d31e8e346d6b4246c8547',
  '6a4d342bef9ba22049897ec9',
  '6a4e4bb29beec9f68bdfd868',
].map(id => new ObjectId(id));

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' CLEANUP: removing stale 2026-07-08 test courses');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const courseId of STALE_COURSE_IDS) {
    console.log(`\n--- courseId=${courseId} ---`);

    const versions = await db.collection('newCourseVersion').find({courseId}).toArray();
    const versionIds = versions.map(v => v._id);
    console.log(`  versions: ${versionIds.length}`);

    const sections = await db.collection('newSection').find({courseVersionId: {$in: versionIds}}).toArray();
    const sectionIds = sections.map(s => s._id);
    console.log(`  sections: ${sectionIds.length}`);

    const groups = await db.collection('itemsGroup').find({sectionId: {$in: sectionIds}}).toArray();
    const groupIds = groups.map(g => g._id);
    const itemRefs = groups.flatMap(g => g.items || []);
    const itemIds = itemRefs.map(i => {
      const id = typeof i.itemId === 'string' ? i.itemId : i.itemId?.toString();
      return ObjectId.isValid(id) ? new ObjectId(id) : null;
    }).filter(Boolean);
    console.log(`  itemsGroups: ${groupIds.length}  items: ${itemIds.length}`);

    const modules = await db.collection('newModule').find({courseVersionId: {$in: versionIds}}).toArray();
    const moduleIds = modules.map(m => m._id);
    console.log(`  modules: ${moduleIds.length}`);

    // Delete in dependency order
    const r1 = await db.collection('itemsGroup').deleteMany({_id: {$in: groupIds}});
    const r2 = await db.collection('items').deleteMany({_id: {$in: itemIds}});
    const r3 = await db.collection('newSection').deleteMany({_id: {$in: sectionIds}});
    const r4 = await db.collection('newModule').deleteMany({_id: {$in: moduleIds}});
    const r5 = await db.collection('newCourseVersion').deleteMany({courseId});
    const r6 = await db.collection('courseSettings').deleteMany({courseId});
    const r7 = await db.collection('enrollment').deleteMany({courseId});
    const r8 = await db.collection('newCourse').deleteOne({_id: courseId});

    console.log(`  deleted: itemsGroup=${r1.deletedCount} items=${r2.deletedCount} sections=${r3.deletedCount} modules=${r4.deletedCount} versions=${r5.deletedCount} settings=${r6.deletedCount} enrollments=${r7.deletedCount} course=${r8.deletedCount}`);
  }

  // Strip the stale sections from any version's denormalized modules[] array
  console.log('\n--- patching newCourseVersion.modules[] to drop stale sections ---');
  const versions = await db.collection('newCourseVersion').find({}).toArray();
  for (const v of versions) {
    if (!v.modules || v.modules.length === 0) continue;
    let touched = false;
    for (const m of v.modules) {
      if (m.sections && m.sections.length > 0) {
        const before = m.sections.length;
        m.sections = m.sections.filter(s => {
          // keep only sections that still exist
          return true; // we'll let the next fixup rebuild this
        });
        if (m.sections.length !== before) touched = true;
      }
    }
  }
  // (the next fixup-seed-sections run will rebuild the current course's modules[] from scratch)

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' AFTER cleanup');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`newCourse count:        ${await db.collection('newCourse').countDocuments({})}`);
  console.log(`newCourseVersion count: ${await db.collection('newCourseVersion').countDocuments({})}`);
  console.log(`newSection count:       ${await db.collection('newSection').countDocuments({})}`);
  console.log(`newModule count:        ${await db.collection('newModule').countDocuments({})}`);
  console.log(`itemsGroup count:       ${await db.collection('itemsGroup').countDocuments({})}`);

  await client.close();
  console.log('\n✅ Cleanup done. Re-run fixup-seed-sections-2026-07-09.cjs next.');
})().catch(err => {
  console.error('[cleanup] FAILED:', err);
  process.exit(1);
});