#!/usr/bin/env node
// diag-verify-link.cjs — Verify the itemsGroups are properly populated after the fix

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const VERSION_ID = '6a50cb21b59da603242f22ac';
const GROUP_IDS = [
  '6a4f774273de56bebbabd666',  // section 1
  '6a4f774273de56bebbabd667',  // section 2
  '6a50cb21b59da603242f22af',  // section 3
  '6a50cb21b59da603242f22b0',  // section 4
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
    console.log('│  POST-FIX VERIFICATION                                       │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    for (let i = 0; i < GROUP_IDS.length; i++) {
      const groupId = GROUP_IDS[i];
      console.log(`\n📦 ITEMSGROUP #${i + 1} (${groupId}):`);
      const ig = await db.collection('itemsGroup').findOne({ _id: new ObjectId(groupId) });
      console.log('  Self:', JSON.stringify(ig, null, 2));

      // Find items in this group
      const items = await db.collection('items').find({ itemsGroupId: new ObjectId(groupId) }).toArray();
      console.log(`  Items in group: ${items.length}`);
      for (const it of items) {
        console.log(`    • _id=${it._id.toString()}  type=${it.type}  name=${it.name}`);
      }

      // Find videos in this group
      const vids = await db.collection('videos').find({ itemsGroupId: new ObjectId(groupId) }).toArray();
      console.log(`  Videos in group: ${vids.length}`);
      for (const v of vids) {
        console.log(`    • _id=${v._id.toString()}  title=${v.title ?? v.name ?? '?'}`);
      }

      // Find quizzes in this group
      const quizzes = await db.collection('quizzes').find({ itemsGroupId: new ObjectId(groupId) }).toArray();
      console.log(`  Quizzes in group: ${quizzes.length}`);
      for (const q of quizzes) {
        console.log(`    • _id=${q._id.toString()}  title=${q.title}`);
      }
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();