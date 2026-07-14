#!/usr/bin/env node
// fix-clean-orphan-items.cjs — Clean up orphan data from the OLD course version
// (6a4f774273de56bebbabd662 / 663) which is no longer our test course.
//
// Our test course version is 6a50cb21b59da603242f22ac. But sections 1 and 2 of
// the embedded module still point to itemsGroups 6a4f774273de56bebbabd666/667
// (the OLD version's itemsGroups).
//
// Plan:
//   1. Renumber sections 3,4 → 1,2 in the embedded module (so the orphan sections
//      are no longer referenced)
//   2. Delete orphan itemsGroups (666, 667), items (668 video, 669 quiz), quizzes (669)
//   3. Delete orphan sections (664, 665)
//   4. Delete orphan watchTime + quiz_submission_results tied to old courseVersionId
//   5. Update enrollment.totalItemsCount → 2

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const COURSE_ID = '6a50cb21b59da603242f22ab';
const VERSION_ID = '6a50cb21b59da603242f22ac';
const USER_ID = '6a4b9f85cc68bde40897fc16';

const ORPHAN_GROUP_IDS = [
  '6a4f774273de56bebbabd666',
  '6a4f774273de56bebbabd667',
];
const ORPHAN_SECTION_IDS = [
  '6a4f774273de56bebbabd664',
  '6a4f774273de56bebbabd665',
];
const ORPHAN_ITEM_IDS = [
  '6a4f774273de56bebbabd668',  // old video
  '6a4f774273de56bebbabd669',  // old quiz
];
const ORPHAN_QUESTION_IDS = [
  '6a4f774273de56bebbabd671',
  '6a4f774273de56bebbabd672',
  '6a4f774273de56bebbabd673',
  '6a4f774273de56bebbabd674',
];
const OLD_VERSION_ID = '6a4f774273de56bebbabd663';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  CLEAN ORPHAN OLD-VERSION DATA                                │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // 1. Renumber embedded sections: 3→1, 4→2 in version.modules[0].sections
    console.log('📐 Renumbering sections (3→1, 4→2):');
    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    if (version?.modules?.[0]?.sections) {
      const sections = version.modules[0].sections;
      const updated = sections.map((s) => {
        const out = { ...s };
        if (s.order === '3') {
          out.order = '1';
        } else if (s.order === '4') {
          out.order = '2';
        }
        return out;
      });
      // Also drop orphan sections (1, 2 from old version)
      const filtered = updated.filter((s) =>
        ORPHAN_SECTION_IDS.indexOf(s.sectionId) === -1,
      );
      await db.collection('newCourseVersion').updateOne(
        { _id: new ObjectId(VERSION_ID) },
        { $set: { 'modules.0.sections': filtered, updatedAt: new Date() } },
      );
      console.log(`  ✓ Kept ${filtered.length} sections, dropped ${sections.length - filtered.length} orphans`);
      for (const s of filtered) {
        console.log(`    • order=${s.order}  sectionId=${s.sectionId}  itemsGroupId=${s.itemsGroupId}`);
      }
    }

    // 2. Delete orphan itemsGroups
    console.log('\n🗑️  Deleting orphan itemsGroups:');
    for (const id of ORPHAN_GROUP_IDS) {
      const r = await db.collection('itemsGroup').deleteOne({ _id: new ObjectId(id) });
      console.log(`  • ${id}: deletedCount=${r.deletedCount}`);
    }

    // 3. Delete orphan sections
    console.log('\n🗑️  Deleting orphan sections:');
    for (const id of ORPHAN_SECTION_IDS) {
      const r = await db.collection('newSection').deleteOne({ _id: new ObjectId(id) });
      console.log(`  • ${id}: deletedCount=${r.deletedCount}`);
    }

    // 4. Delete orphan items
    console.log('\n🗑️  Deleting orphan items (old video + quiz):');
    for (const id of ORPHAN_ITEM_IDS) {
      const r = await db.collection('items').deleteOne({ _id: new ObjectId(id) });
      console.log(`  • ${id}: deletedCount=${r.deletedCount}`);
    }

    // 5. Delete orphan quiz row (same id as item 669)
    console.log('\n🗑️  Deleting orphan quiz:');
    const rq = await db.collection('quizzes').deleteMany({ _id: { $in: ORPHAN_ITEM_IDS.map((id) => new ObjectId(id)) } });
    console.log(`  • ${ORPHAN_ITEM_IDS.join(', ')}: deletedCount=${rq.deletedCount}`);

    // 6. Delete orphan questions
    console.log('\n🗑️  Deleting orphan questions:');
    for (const id of ORPHAN_QUESTION_IDS) {
      const r = await db.collection('questions').deleteOne({ _id: new ObjectId(id) });
      console.log(`  • ${id}: deletedCount=${r.deletedCount}`);
    }

    // 7. Delete orphan watchTime records
    console.log('\n🗑️  Deleting orphan watchTime records:');
    const rw = await db.collection('watchTime').deleteMany({
      courseVersionId: new ObjectId(OLD_VERSION_ID),
    });
    console.log(`  • ${OLD_VERSION_ID}: deletedCount=${rw.deletedCount}`);

    // 8. Delete orphan quiz submission results
    console.log('\n🗑️  Deleting orphan quiz submission results:');
    const rqs = await db.collection('quiz_submission_results').deleteMany({
      quizId: { $in: ORPHAN_ITEM_IDS.map((id) => new ObjectId(id)) },
    });
    console.log(`  • deletedCount=${rqs.deletedCount}`);

    // 9. Delete orphan quiz attempts
    console.log('\n🗑️  Deleting orphan quiz attempts:');
    const ra = await db.collection('quiz_attempts').deleteMany({
      quizId: { $in: ORPHAN_ITEM_IDS.map((id) => new ObjectId(id)) },
    });
    console.log(`  • deletedCount=${ra.deletedCount}`);

    // 10. Update enrollment.totalItemsCount → 2 + reset percentCompleted/completedItemsCount
    console.log('\n🔧 Updating enrollment totalItemsCount → 2:');
    const re = await db.collection('enrollment').updateOne(
      { userId: new ObjectId(USER_ID), courseId: new ObjectId(COURSE_ID) },
      {
        $set: {
          totalItemsCount: 2,
          percentCompleted: 0,
          completedItemsCount: 0,
          updatedAt: new Date(),
        },
      },
    );
    console.log(`  • matched=${re.matchedCount}, modified=${re.modifiedCount}`);

    // 11. Delete orphan progress rows (yesterday's from old version)
    console.log('\n🗑️  Deleting orphan progress records:');
    const rp = await db.collection('progress').deleteMany({
      courseVersionId: new ObjectId(OLD_VERSION_ID),
    });
    console.log(`  • deletedCount=${rp.deletedCount}`);

    // 12. Delete orphan progress row from new version if it has stale currentItem pointing to old
    console.log('\n🔧 Cleaning up progress for new version:');
    const rp2 = await db.collection('progress').updateMany(
      { courseVersionId: new ObjectId(VERSION_ID) },
      {
        $unset: {
          currentModule: '',
          currentSection: '',
          currentItem: '',
          completed: '',
        },
        $set: {
          updatedAt: new Date(),
        },
      },
    );
    console.log(`  • matched=${rp2.matchedCount}, modified=${rp2.modifiedCount}`);

    console.log('\n✅ Done. The course now has only 2 sections: video + quiz.');
    console.log('>>> Restart backend, hard-refresh dashboard, click course → module → watch video → take quiz.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();