#!/usr/bin/env node
// diag-quiz-shape-v2.cjs — Show the actual question, plus copy details from quizzes→items

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

    const QUESTION_ID = '6a50cb21346ec8e5ccf48ebe';
    const QUIZ_ID = '6a50cb21b59da603242f22b2';
    const VIDEO_ID = '6a50cb21b59da603242f22b1';

    console.log('\n--- QUESTION (full) ---');
    const q = await db.collection('questions').findOne({ _id: new ObjectId(QUESTION_ID) });
    console.log(JSON.stringify(q, null, 2));

    console.log('\n--- VIDEO in videos collection ---');
    const v = await db.collection('videos').findOne({ _id: new ObjectId(VIDEO_ID) });
    console.log(JSON.stringify(v, null, 2));

    // COPY: from quizzes.details → items.details for the quiz
    console.log('\n--- Copying details from quizzes → items for the quiz ---');
    const r = await db.collection('items').updateOne(
      { _id: new ObjectId(QUIZ_ID) },
      {
        $set: {
          details: {
            questionBankRefs: [
              { bankId: '6a50cb21346ec8e5ccf48ebd', count: 1 },
            ],
            passThreshold: 0.5,
            maxAttempts: -1,
            quizType: 'DEADLINE',
            releaseTime: '2026-07-09T10:36:17.380Z',
            questionVisibility: 1,
            approximateTimeToComplete: '00:05:00',
            allowPartialGrading: true,
            allowHint: true,
            showCorrectAnswersAfterSubmission: true,
            showExplanationAfterSubmission: true,
            showScoreAfterSubmission: true,
            allowSkip: false,
          },
          updatedAt: new Date(),
        },
      },
    );
    console.log(`Quiz details copied to items: matched=${r.matchedCount} modified=${r.modifiedCount}`);

    // For the video, items already has details.URL from earlier fix
    console.log('\n--- Verifying items details ---');
    const items = await db.collection('items').find({}).toArray();
    for (const it of items) {
      console.log(`_id=${it._id} type=${it.type} hasDetails=${!!it.details}`);
      if (it.details) console.log(`  details keys: ${Object.keys(it.details).join(', ')}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();