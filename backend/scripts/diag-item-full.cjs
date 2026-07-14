#!/usr/bin/env node
// diag-item-full.cjs — Full dump of one item per group, to see what fields exist
// (the frontend needs fields like questionBankRefs, etc. for quiz items)

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
    console.log('│  ITEM FULL DUMP                                              │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const items = await db.collection('items').find({ courseVersionId: { $exists: true } }).toArray();
    for (const it of items) {
      console.log(`\n--- ITEM ${it._id} (${it.type}) ---`);
      console.log(JSON.stringify(it, null, 2));
    }

    console.log('\n--- QUIZZES (with courseVersionId) ---');
    const quizzes = await db.collection('quizzes').find({ courseVersionId: { $exists: true } }).toArray();
    for (const q of quizzes) {
      console.log(`\n--- QUIZ ${q._id} ---`);
      console.log(JSON.stringify(q, null, 2).slice(0, 2000));
    }

    console.log('\n--- QUESTIONS ---');
    const questions = await db.collection('questions').find({}).toArray();
    for (const q of questions) {
      console.log(`\n--- QUESTION ${q._id} ---`);
      console.log(JSON.stringify(q, null, 2).slice(0, 800));
    }

    console.log('\n--- QUESTION BANKS ---');
    const banks = await db.collection('questionBanks').find({}).toArray();
    for (const b of banks) {
      console.log(`\n--- QB ${b._id} ---`);
      console.log(JSON.stringify(b, null, 2).slice(0, 800));
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();