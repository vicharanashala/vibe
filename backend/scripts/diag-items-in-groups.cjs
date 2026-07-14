#!/usr/bin/env node
// diag-items-in-groups.cjs — Check what items would be returned for each
// itemsGroupId (6a50cb21b59da603242f22af and 6a50cb21b59da603242f22b0)

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

const VIDEO_IG = '6a50cb21b59da603242f22af';
const QUIZ_IG = '6a50cb21b59da603242f22b0';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    for (const [label, igId] of [['VIDEO', VIDEO_IG], ['QUIZ', QUIZ_IG]]) {
      console.log(`\n--- itemsGroup ${igId} (${label}) ---`);

      // Check standalone items collection
      const items = await db.collection('items').find({ itemsGroupId: new ObjectId(igId) }).toArray();
      console.log(`items collection: ${items.length} items`);
      for (const it of items) {
        console.log(`  • _id=${it._id} type=${it.type} name="${it.name}"`);
        console.log(`      isHidden=${it.isHidden} isDeleted=${it.isDeleted}`);
        console.log(`      details.URL=${it.details?.URL}`);
        if (it.type === 'QUIZ') console.log(`      details.questionBankRefs=${JSON.stringify(it.details?.questionBankRefs)}`);
      }

      // Check embedded in itemsGroup
      const ig = await db.collection('itemsGroup').findOne({ _id: new ObjectId(igId) });
      console.log(`itemsGroup embedded items: ${ig?.items?.length ?? 0}`);
      for (const it of ig?.items || []) {
        console.log(`  • ${it.type} name="${it.name}" (itemId=${it.itemId})`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();