#!/usr/bin/env node
// fix-strip-version-orphans.cjs — Strip orphan section references from version.modules
// (the previous cleanup script's filter didn't match for some reason; do it directly here)

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const VERSION_ID = '6a50cb21b59da603242f22ac';

const ORPHAN_SECTION_IDS = [
  '6a4f774273de56bebbabd664',
  '6a4f774273de56bebbabd665',
];

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  STRIP ORPHAN SECTIONS FROM VERSION.MODULES                   │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    if (!version) {
      console.log('❌ Version not found');
      return;
    }
    const sectionsBefore = version.modules?.[0]?.sections || [];
    console.log(`Sections before: ${sectionsBefore.length}`);

    // Filter: keep only sections NOT in ORPHAN_SECTION_IDS
    // Compare using .toString() to handle ObjectId/string mismatches
    const sectionsAfter = sectionsBefore.filter((s) => {
      const sid = typeof s.sectionId === 'string' ? s.sectionId : s.sectionId?.toString();
      return !ORPHAN_SECTION_IDS.includes(sid);
    });
    console.log(`Sections after: ${sectionsAfter.length}`);
    console.log('Remaining sections:');
    for (const s of sectionsAfter) {
      console.log(`  • order=${s.order} sectionId=${s.sectionId} itemsGroupId=${s.itemsGroupId}`);
    }

    const result = await db.collection('newCourseVersion').updateOne(
      { _id: new ObjectId(VERSION_ID) },
      { $set: { 'modules.0.sections': sectionsAfter, updatedAt: new Date() } },
    );
    console.log(`\nUpdate: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

    // Verify
    const verify = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    console.log('\nVerification (post-update):');
    for (const s of verify.modules?.[0]?.sections || []) {
      console.log(`  • order=${s.order} sectionId=${s.sectionId} itemsGroupId=${s.itemsGroupId}`);
    }

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();