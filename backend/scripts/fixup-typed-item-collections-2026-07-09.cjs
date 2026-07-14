// ItemRepository.readItemsGroup filters items by looking them up in their TYPED
// collection (videos, quizzes, blogs, projects, feedback_forms) and silently
// drops any items not found there. Our seed put items only in the generic
// 'items' collection, so the typed lookup returns null and the response comes
// back empty.
//
// Fix: copy any items found in 'itemsGroup.items' that don't have a matching
// doc in their typed collection, into that typed collection. Idempotent.

const { MongoClient, ObjectId } = require('mongodb');

const ITEM_GROUP_IDS = [
  '6a4f774273de56bebbabd666',
  '6a4f774273de56bebbabd667',
];

const TYPE_TO_COLLECTION = {
  VIDEO: 'videos',
  QUIZ: 'quizzes',
  BLOG: 'blogs',
  PROJECT: 'projects',
  FEEDBACK: 'feedback_forms',
};

(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  try {
    await client.connect();
    const db = client.db('vibe');
    let created = 0;
    let skipped = 0;

    for (const gid of ITEM_GROUP_IDS) {
      const group = await db.collection('itemsGroup').findOne({ _id: new ObjectId(gid) });
      if (!group) {
        console.log(`itemsGroup ${gid} not found, skipping`);
        continue;
      }
      console.log(`\n-- itemsGroup ${gid} (${(group.items || []).length} items) --`);
      for (const ref of group.items || []) {
        const id = ref._id ? new ObjectId(ref._id) : (ref.itemId ? new ObjectId(ref.itemId) : null);
        if (!id) {
          console.log(`  ! ref has no _id or itemId, skipping:`, ref);
          continue;
        }
        const typedName = TYPE_TO_COLLECTION[ref.type];
        if (!typedName) {
          console.log(`  ! unknown type ${ref.type} for ref ${id}, skipping`);
          continue;
        }
        const existing = await db.collection(typedName).findOne({ _id: id });
        if (existing) {
          console.log(`  - ${typedName}.${id} already exists (isDeleted=${existing.isDeleted}), leaving as-is`);
          skipped++;
          continue;
        }
        // Try to find source-of-truth in 'items' or 'item' collection
        const source = await db.collection('items').findOne({ _id: id });
        const doc = source ? { ...source } : {
          _id: id,
          name: ref.name || 'Untitled',
          description: '',
          type: ref.type,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        delete doc.isDeleted;
        delete doc.deletedAt;
        doc.isHidden = false;
        await db.collection(typedName).insertOne(doc);
        console.log(`  + created ${typedName}.${id} name="${doc.name}"`);
        created++;
      }
    }

    console.log(`\nDone. created=${created} skipped=${skipped}`);
  } finally {
    await client.close();
  }
})().catch(err => {
  console.error('[fixup-typed-item-collections] FAILED:', err);
  process.exit(1);
});
