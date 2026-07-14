#!/usr/bin/env node
/**
 * seed-quiz-content-2026-07-09.cjs
 * --------------------------------
 * One-off fixup that seeds the quiz item with:
 *   1. A question doc in the `questions` collection (SOL/MCQ shape)
 *   2. A `questionBanks` doc whose `questions` field is just an array of
 *      ObjectId refs (matches the real schema)
 *   3. details.questionBankRefs on the quiz doc pointing at that bank
 *
 * Why v2 (overhauled from v1):
 *   v1 put questions INLINE in the bank doc. The backend's
 *   QuestionBankRepository.getById does
 *   `result.questions.map(qId => new ObjectId(qId))` and then
 *   `questionsCollection.find({_id: {$in: ...}})`. Inline questions make
 *   `qId` a whole object → `new ObjectId(obj)` throws BSONError.
 *
 * After this script the student sees "Ready to Start Your Quiz?" → Start →
 * one MCQ → submit → graded → progress moves to 100%.
 *
 * Run from backend/:
 *   node backend/scripts/seed-quiz-content-2026-07-09.cjs
 *
 * Idempotent — safe to re-run. Drops and rewrites the previously-bad
 * v1-shape bank doc by reusing the deterministic bank id.
 */

const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../.env')});

const {MongoClient, ObjectId} = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017/?directConnection=true';
const DB_NAME = process.env.DB_NAME || 'vibe';

// Seed IDs from seed-test-course.cjs
const QUIZ_ITEM_ID = '6a4f774273de56bebbabd669';
const COURSE_ID = '6a4f774273de56bebbabd662';
const VERSION_ID = '6a4f774273de56bebbabd663';

// Deterministic ids — re-runs converge, no orphans.
const BANK_ID = '6a4f774273de56bebbabd670';
const Q1_ID = '6a4f774273de56bebbabd671';
const OPT_FOX = '6a4f774273de56bebbabd672'; // correct
const OPT_PANDA = '6a4f774273de56bebbabd673';
const OPT_DRAGON = '6a4f774273de56bebbabd674';

(async () => {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log(`[fixup-quiz] Connected to ${DB_NAME} @ 127.0.0.1`);

    const now = new Date();
    const userIdForCreatedBy = new ObjectId('6a4b9f85cc68bde40897fc16'); // sahasra

    // ---------------------------------------------------------------
    // 1) Upsert SOL question doc into `questions` collection.
    //    Schema follows BaseQuestion + SOLQuestion (incorrectLotItems,
    //    correctLotItem). `lot` is NOT stored — SOLQuestionRenderer
    //    builds the rendered `lot` from incorrect+correct at render time.
    // ---------------------------------------------------------------
    const questionDoc = {
      _id: new ObjectId(Q1_ID),
      createdBy: userIdForCreatedBy,
      text: "What is the name of ViBe's learning companion?",
      type: 'SELECT_ONE_IN_LOT',
      isParameterized: false,
      bloomLevel: 'knowledge',
      parameters: undefined,
      hint: undefined,
      timeLimitSeconds: 60,
      points: 1,
      priority: 'LOW',
      source: 'INSTRUCTOR',
      reviewStatus: 'APPROVED',
      incorrectLotItems: [
        {_id: new ObjectId(OPT_PANDA), text: 'Panda', explaination: ''},
        {_id: new ObjectId(OPT_DRAGON), text: 'Dragon', explaination: ''},
      ],
      correctLotItem: {
        _id: new ObjectId(OPT_FOX),
        text: 'Fox',
        explaination: "It's a fox — the companion doc shows animal: 'fox'.",
      },
      isDeleted: false,
      deletedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('questions').replaceOne(
      {_id: new ObjectId(Q1_ID)},
      questionDoc,
      {upsert: true},
    );
    console.log(`[fixup-quiz] Upserted questions._id=${Q1_ID}`);

    // ---------------------------------------------------------------
    // 2) Upsert questionBanks doc — `questions` is a refs array,
    //    NOT inline objects.
    // ---------------------------------------------------------------
    const bankDoc = {
      _id: new ObjectId(BANK_ID),
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
      title: 'Demo: Companion MCQ',
      description:
        'Single MCQ used for verifying the Digital Learning Companion end-to-end growth/mood flow.',
      questions: [new ObjectId(Q1_ID)],
      tags: ['companion-demo'],
      points: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: undefined,
    };

    await db.collection('questionBanks').replaceOne(
      {_id: new ObjectId(BANK_ID)},
      bankDoc,
      {upsert: true},
    );
    console.log(`[fixup-quiz] Upserted questionBanks._id=${BANK_ID}`);

    // ---------------------------------------------------------------
    // 3) Update the quiz doc with full details + questionBankRefs.
    // ---------------------------------------------------------------
    const releaseTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const updateRes = await db.collection('quizzes').updateOne(
      {_id: new ObjectId(QUIZ_ITEM_ID)},
      {
        $set: {
          details: {
            questionBankRefs: [
              {
                bankId: BANK_ID, // string per IQuestionBankRef.bankId typing
                count: 1, // pick 1 question
              },
            ],
            passThreshold: 0.5,
            maxAttempts: -1, // unlimited
            quizType: 'DEADLINE',
            releaseTime: releaseTime,
            questionVisibility: 1,
            approximateTimeToComplete: '00:05:00',
            allowPartialGrading: true,
            allowHint: true,
            allowSkip: true,
            showCorrectAnswersAfterSubmission: true,
            showExplanationAfterSubmission: true,
            showScoreAfterSubmission: true,
          },
          updatedAt: now,
        },
      },
    );

    if (updateRes.matchedCount === 0) {
      console.error(
        `[fixup-quiz] No quiz doc found with _id=${QUIZ_ITEM_ID}. Run fixup-typed-item-collections-2026-07-09.cjs first.`,
      );
      process.exit(1);
    }
    console.log(
      `[fixup-quiz] Updated quizzes.${QUIZ_ITEM_ID}: matched=${updateRes.matchedCount} modified=${updateRes.modifiedCount}`,
    );

    console.log('[fixup-quiz] Done. Hard-refresh course page, click quiz.');
  } catch (err) {
    console.error('[fixup-quiz] Failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();
