#!/usr/bin/env node
// fix-quiz-question-shape.cjs — Repair questions that have the new shape
// (lot.lotItems[]) but missing type, and convert to the legacy shape
// (correctLotItem + incorrectLotItems[]) that the quiz processor expects.
//
// Two questions affected:
//   • 6a50c6c74cfe15594df7d91d (orphan — bank 6a50c6c74cfe15594df7d91c, not used by our test course)
//   • 6a50cb21346ec8e5ccf48ebe (used by bank 6a50cb21346ec8e5ccf48ebd — BOTH our quizzes point here)

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
    console.log('│  REPAIR QUESTION SHAPE (new → legacy SELECT_ONE_IN_LOT)      │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // Find all questions missing `type` field — those are the broken ones
    const broken = await db.collection('questions').find({
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: '' },
      ],
    }).toArray();

    console.log(`Found ${broken.length} question(s) with missing/empty type:\n`);

    for (const q of broken) {
      console.log(`\n--- Question ${q._id.toString()} ---`);
      console.log('Before:', JSON.stringify(q).slice(0, 600));

      // Convert lot.lotItems to correctLotItem + incorrectLotItems
      const lotItems = q.lot?.lotItems || [];
      // Heuristic: item with "Correct!" or "Correct" in explaination is the correct one
      let correctIdx = lotItems.findIndex(li =>
        /correct/i.test(li.explaination || '') && !/wrong/i.test(li.explaination || ''),
      );
      if (correctIdx === -1) {
        // Try matching by exact text "Fox" (the known answer) — fallback
        correctIdx = lotItems.findIndex(li => /fox/i.test(li.itemText || ''));
      }
      if (correctIdx === -1) {
        // Default to first item
        correctIdx = 0;
      }

      const correctLotItem = lotItems[correctIdx];
      const incorrectLotItems = lotItems.filter((_, i) => i !== correctIdx);

      const update = {
        $set: {
          type: 'SELECT_ONE_IN_LOT',
          isParameterized: q.isParameterized ?? false,
          bloomLevel: q.bloomLevel ?? 'knowledge',
          parameters: q.parameters ?? null,
          hint: q.hintText ?? q.hint ?? null,
          timeLimitSeconds: q.timeLimitSeconds ?? q.timeLimit ?? 60,
          points: q.points ?? 1,
          priority: q.priority ?? 'LOW',
          source: q.source ?? 'INSTRUCTOR',
          reviewStatus: q.reviewStatus ?? 'APPROVED',
          correctLotItem: {
            _id: correctLotItem._id,
            text: correctLotItem.itemText,
            explaination: correctLotItem.explaination || '',
          },
          incorrectLotItems: incorrectLotItems.map(li => ({
            _id: li._id,
            text: li.itemText,
            explaination: li.explaination || '',
          })),
          updatedAt: new Date(),
        },
        $unset: {
          lot: '',
          lotItems: '',
          hintText: '',
        },
      };

      const result = await db.collection('questions').updateOne({ _id: q._id }, update);
      console.log(`Updated: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

      const after = await db.collection('questions').findOne({ _id: q._id });
      console.log('After:', JSON.stringify(after).slice(0, 600));
    }

    console.log('\n✅ Done. Quiz should now be able to start.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();