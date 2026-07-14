#!/usr/bin/env node
// diag-quiz-shape.cjs — Show full quiz document with all fields

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const QUIZ_ID = '6a50cb21b59da603242f22b2';
const QB_ID = '6a50cb21346ec8e5ccf48ebd';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n--- QUIZ document ---');
    const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(QUIZ_ID) });
    console.log(JSON.stringify(quiz, null, 2));

    console.log('\n--- ITEM document (quiz) ---');
    const item = await db.collection('items').findOne({ _id: new ObjectId(QUIZ_ID) });
    console.log(JSON.stringify(item, null, 2));

    console.log('\n--- QUESTION BANK ---');
    const qb = await db.collection('questionBanks').findOne({ _id: new ObjectId(QB_ID) });
    console.log(JSON.stringify(qb, null, 2));

    console.log('\n--- QUESTIONS in QB ---');
    const qs = await db.collection('questions').find({ questionBankId: new ObjectId(QB_ID) }).toArray();
    for (const q of qs) {
      console.log(JSON.stringify(q, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();