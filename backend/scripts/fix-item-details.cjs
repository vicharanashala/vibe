#!/usr/bin/env node
// fix-item-details.cjs — Copy proper details from legacy collections (videos / quizzes)
// into the unified items collection. This makes items endpoint return complete
// details, and ALSO lets the ItemRepository.readItemsGroup() fallback find them.
//
// For VIDEO items: copy from videos collection.
// For QUIZ items: copy from quizzes collection.

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
    console.log('│  FIX: Copy video/quiz details → items collection             │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const items = await db.collection('items').find({}).toArray();
    console.log(`Found ${items.length} items`);

    for (const item of items) {
      if (item.type === 'VIDEO') {
        const video = await db.collection('videos').findOne({ _id: new ObjectId(item._id) });
        if (video) {
          const detailsToSet = {
            URL: video.details?.URL || video.URL || '',
            startTime: video.details?.startTime || 0,
            endTime: video.details?.endTime || video.details?.duration || 0,
            points: video.details?.points || 0,
            description: video.details?.description || video.description || '',
          };
          const r = await db.collection('items').updateOne(
            { _id: new ObjectId(item._id) },
            { $set: { details: detailsToSet, updatedAt: new Date() } },
          );
          console.log(`  ✓ VIDEO ${item._id}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
        } else {
          console.log(`  ✗ VIDEO ${item._id}: no video document found`);
        }
      } else if (item.type === 'QUIZ') {
        const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(item._id) });
        if (quiz) {
          const detailsToSet = {
            questionBankRefs: quiz.details?.questionBankRefs || [],
            passThreshold: quiz.details?.passThreshold ?? 0.5,
            maxAttempts: quiz.details?.maxAttempts ?? -1,
            quizType: quiz.details?.quizType || 'DEADLINE',
            releaseTime: quiz.details?.releaseTime || new Date().toISOString(),
            questionVisibility: quiz.details?.questionVisibility ?? 1,
            approximateTimeToComplete: quiz.details?.approximateTimeToComplete || '00:05:00',
            allowPartialGrading: quiz.details?.allowPartialGrading ?? true,
            allowHint: quiz.details?.allowHint ?? true,
            showCorrectAnswersAfterSubmission:
              quiz.details?.showCorrectAnswersAfterSubmission ?? true,
            showExplanationAfterSubmission:
              quiz.details?.showExplanationAfterSubmission ?? true,
            showScoreAfterSubmission:
              quiz.details?.showScoreAfterSubmission ?? true,
            allowSkip: quiz.details?.allowSkip ?? false,
          };
          const r = await db.collection('items').updateOne(
            { _id: new ObjectId(item._id) },
            { $set: { details: detailsToSet, updatedAt: new Date() } },
          );
          console.log(`  ✓ QUIZ ${item._id}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
        } else {
          console.log(`  ✗ QUIZ ${item._id}: no quiz document found`);
        }
      }
    }

    // Verify
    console.log('\n--- Verify items.details ---');
    const verify = await db.collection('items').find({}).toArray();
    for (const it of verify) {
      const d = it.details || {};
      console.log(`  ${it._id} (${it.type}): hasDetails=${!!it.details}`);
      if (it.type === 'QUIZ') {
        console.log(`    questionBankRefs: ${(d.questionBankRefs || []).length} banks`);
      } else if (it.type === 'VIDEO') {
        console.log(`    URL: ${d.URL}`);
      }
    }

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();