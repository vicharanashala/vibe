// scripts/cleanup-orphans-2026-07-09.cjs
// Surgically delete orphan itemsGroups, sections, modules, and items that
// belong to no current course. Use this AFTER the fixup has run so we know
// which IDs belong to which course.
//
// Stale itemsGroups (pre-2026-07-09 test data):
//   6a4d31e8e346d6b4246c854b — first stale itemsGroup (video?)
//   6a4d31e8e346d6b4246c854c — first stale itemsGroup (quiz?)
//   6a4d342bef9ba22049897ecd — second stale itemsGroup (video?)
//   6a4d342bef9ba22049897ece — second stale itemsGroup (quiz?)
//
// Stale sections (auto-created by fixup; orphan because itemsGroups will be gone):
//   6a4d31e8e346d6b4246c8549, 6a4d31e8e346d6b4246c854a,
//   6a4d342bef9ba22049897ecb, 6a4d342bef9ba22049897ecc
//
// Stale modules (pre-2026-07-09, no fresh courseVersionId anymore):
//   any newModule NOT pointing at version 6a4f774273de56bebbabd663
//   (we'll delete by courseVersionId filter)
//
// This script is surgical: it operates on specific IDs and is safe to re-run
// (everything is idempotent via $in filters).

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

const STALE_ITEMS_GROUPS = [
  '6a4d31e8e346d6b4246c854b',
  '6a4d31e8e346d6b4246c854c',
  '6a4d342bef9ba22049897ecd',
  '6a4d342bef9ba22049897ece',
].map(id => new ObjectId(id));

const STALE_SECTIONS = [
  '6a4d31e8e346d6b4246c8549',
  '6a4d31e8e346d6b4246c854a',
  '6a4d342bef9ba22049897ecb',
  '6a4d342bef9ba22049897ecc',
].map(id => new ObjectId(id));

const FRESH_VERSION_ID = new ObjectId('6a4f774273de56bebbabd663');

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' ORPHAN CLEANUP: removing stale itemsGroups, sections, modules');
  console.log('═══════════════════════════════════════════════════════════════');

  // Read stale itemsGroups first to know which items they reference
  const staleIGs = await db.collection('itemsGroup').find({_id: {$in: STALE_ITEMS_GROUPS}}).toArray();
  const staleItemIds = staleIGs.flatMap(g => (g.items || []).map(i => {
    const id = typeof i.itemId === 'string' ? i.itemId : i.itemId?.toString();
    return ObjectId.isValid(id) ? new ObjectId(id) : null;
  })).filter(Boolean);
  console.log(`Stale itemsGroups: ${staleIGs.length}  → ${staleItemIds.length} referenced item(s)`);

  const r1 = await db.collection('itemsGroup').deleteMany({_id: {$in: STALE_ITEMS_GROUPS}});
  console.log(`✓ Deleted ${r1.deletedCount} stale itemsGroup(s)`);

  if (staleItemIds.length) {
    const r2 = await db.collection('items').deleteMany({_id: {$in: staleItemIds}});
    console.log(`✓ Deleted ${r2.deletedCount} stale item(s)`);
  }

  const r3 = await db.collection('newSection').deleteMany({_id: {$in: STALE_SECTIONS}});
  console.log(`✓ Deleted ${r3.deletedCount} stale newSection(s)`);

  // Modules whose courseVersionId is NOT the fresh one — these are stale
  const r4 = await db.collection('newModule').deleteMany({courseVersionId: {$ne: FRESH_VERSION_ID}});
  console.log(`✓ Deleted ${r4.deletedCount} stale newModule(s) (kept those for the fresh version)`);

  // Strip the stale sections from the fresh version's denormalized modules[] array,
  // keep only sections whose _id still exists in newSection
  console.log('\n--- patching fresh version.modules[] ---');
  const version = await db.collection('newCourseVersion').findOne({_id: FRESH_VERSION_ID});
  if (version && version.modules) {
    const liveSectionIds = new Set(
      (await db.collection('newSection').find({}).toArray()).map(s => s._id.toString())
    );
    let kept = 0;
    let dropped = 0;
    for (const m of version.modules) {
      const before = (m.sections || []).length;
      m.sections = (m.sections || []).filter(s => liveSectionIds.has(s._id.toString()));
      const after = m.sections.length;
      dropped += (before - after);
      kept += after;
    }
    await db.collection('newCourseVersion').updateOne(
      {_id: FRESH_VERSION_ID},
      {$set: {modules: version.modules, updatedAt: new Date()}},
    );
    console.log(`  patched: kept ${kept} section(s), dropped ${dropped} stale`);
  }

  // Also strip orphan entries inside the itemsGroup docs that *do* belong to the fresh course —
  // this protects against any itemsGroup that may have an item not in the items collection.
  // (skipped — we already attached our two fresh itemsGroups correctly)

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' AFTER cleanup');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`newCourse count:        ${await db.collection('newCourse').countDocuments({})}`);
  console.log(`newCourseVersion count: ${await db.collection('newCourseVersion').countDocuments({})}`);
  console.log(`newSection count:       ${await db.collection('newSection').countDocuments({})}`);
  console.log(`newModule count:        ${await db.collection('newModule').countDocuments({})}`);
  console.log(`itemsGroup count:       ${await db.collection('itemsGroup').countDocuments({})}`);
  console.log(`items count:            ${await db.collection('items').countDocuments({})}`);

  await client.close();
  console.log('\n✅ Orphan cleanup done.');
})().catch(err => {
  console.error('[cleanup-orphans] FAILED:', err);
  process.exit(1);
});