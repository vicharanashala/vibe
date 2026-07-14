// scripts/diag-itemsgroup-shape-2026-07-09.cjs
// Dump the itemsGroup documents that the section chain points to, in detail.
const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const SECTION1_ID = new ObjectId('6a4f774273de56bebbabd664');
const SECTION2_ID = new ObjectId('6a4f774273de56bebbabd665');

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('=== itemsGroup for SECTION1 (video section) ===');
  // Try matching by sectionId as ObjectId
  let g1 = await db.collection('itemsGroup').findOne({sectionId: SECTION1_ID});
  if (!g1) g1 = await db.collection('itemsGroup').findOne({sectionId: SECTION1_ID.toString()});
  if (g1) {
    console.log(JSON.stringify(g1, null, 2));
  } else {
    console.log('NOT FOUND by sectionId = ObjectId or string');
  }

  console.log('');
  console.log('=== itemsGroup for SECTION2 (quiz section) ===');
  let g2 = await db.collection('itemsGroup').findOne({sectionId: SECTION2_ID});
  if (!g2) g2 = await db.collection('itemsGroup').findOne({sectionId: SECTION2_ID.toString()});
  if (g2) {
    console.log(JSON.stringify(g2, null, 2));
  } else {
    console.log('NOT FOUND by sectionId = ObjectId or string');
  }

  console.log('');
  console.log('=== Try direct read by _id (which is what readItemsGroup takes) ===');
  // The version's section.itemsGroupId is what readItemsGroup is called with.
  // Dump the section from the version to see what itemsGroupId it stores.
  const version = await db.collection('newCourseVersion').findOne({_id: new ObjectId('6a4f774273de56bebbabd663')});
  for (const m of version.modules || []) {
    for (const s of m.sections || []) {
      console.log(`section ${s.sectionId} -> itemsGroupId=${s.itemsGroupId} (${typeof s.itemsGroupId})`);
      const igId = s.itemsGroupId;
      const tryIds = [
        typeof igId === 'string' ? igId : null,
        igId,
      ].filter(Boolean);
      const matches = await db.collection('itemsGroup').find({_id: {$in: tryIds}}).toArray();
      console.log(`  matched itemsGroup rows: ${matches.length}`);
      for (const m of matches) {
        console.log(`    _id=${m._id} items.length=${(m.items || []).length}`);
      }
    }
  }

  await client.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});