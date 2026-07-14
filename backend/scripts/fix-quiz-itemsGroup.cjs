#!/usr/bin/env node
// fix-quiz-itemsGroup.cjs — Re-link each quiz to match its parent item's itemsGroupId
// The items are correctly linked; the quizzes' itemsGroupId was corrupted.

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  FIX QUIZ → itemsGroupId LINKAGE                              │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const items = await db.collection('items').find({ type: 'QUIZ' }).toArray();
    for (const it of items) {
      const groupId = it.itemsGroupId?.toString?.() ?? it.itemsGroupId;
      if (!groupId) {
        console.log(`  • Quiz item ${it._id.toString()}: no itemsGroupId on item — skipping`);
        continue;
      }
      const result = await db.collection('quizzes').updateOne(
        { _id: it._id },
        {
          $set: {
            itemsGroupId: new ObjectId(groupId),
            courseId: it.courseId,
            courseVersionId: it.courseVersionId,
            updatedAt: new Date(),
          },
        },
      );
      console.log(`  • Quiz ${it._id.toString()}: relinked to itemsGroup ${groupId} (matched=${result.matchedCount}, modified=${result.modifiedCount})`);
    }

    console.log('\n✅ Done. Now the frontend should be able to load the quiz.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();