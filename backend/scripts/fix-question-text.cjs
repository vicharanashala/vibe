#!/usr/bin/env node
// fix-question-text.cjs — Add missing `text` field to questions that have `questionText`
// but no `text` field. Frontend Quiz component reads `question.text`, not `questionText`.

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
    console.log('│  ADD text FIELD TO QUESTIONS (was questionText only)          │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const questions = await db.collection('questions').find({}).toArray();
    for (const q of questions) {
      const updates = {};

      // Add `text` from `questionText` if `text` is missing
      if (!q.text && q.questionText) {
        updates.text = q.questionText;
      }
      // Add `type` from `questionType` if missing (already done, but double-check)
      if (!q.type && q.questionType) {
        updates.type = q.questionType;
      }
      // Some questions are missing `name`
      if (!q.name && q.questionText) {
        updates.name = q.questionText.slice(0, 50);
      }
      // Ensure `description` field exists (used by some backend code)
      if (!q.description) {
        updates.description = '';
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        const result = await db.collection('questions').updateOne(
          { _id: q._id },
          { $set: updates },
        );
        console.log(`  ✓ ${q._id.toString()}: ${Object.keys(updates).join(', ')} (modified=${result.modifiedCount})`);
      } else {
        console.log(`  – ${q._id.toString()}: nothing to add`);
      }
    }

    console.log('\n✅ Done. Quiz should now render the question text.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();