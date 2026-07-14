#!/usr/bin/env node
// diag-ig-embedded.cjs — Dump itemsGroup embedded items + look for old IDs

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

    console.log('\n--- ALL itemsGroup EMBEDDED items ---');
    const igs = await db.collection('itemsGroup').find({}).toArray();
    for (const ig of igs) {
      console.log(`\nitemsGroup ${ig._id.toString()}: ${ig.items?.length || 0} items embedded`);
      if (ig.items) {
        for (const it of ig.items) {
          console.log(`  • ${it.itemId || it._id}  type=${it.type}  name=${it.name}`);
        }
      }
    }

    console.log('\n--- ALL items w/ courseVersionId 6a50cb21b59da603242f22ac ---');
    const items = await db.collection('items').find({
      courseVersionId: new ObjectId('6a50cb21b59da603242f22ac'),
    }).toArray();
    for (const it of items) {
      console.log(`  • ${it._id}  type=${it.type}  name=${it.name}  itemsGroupId=${it.itemsGroupId?.toString?.() ?? it.itemsGroupId}`);
    }

    console.log('\n--- ALL quizzes w/ courseVersionId 6a50cb21b59da603242f22ac ---');
    const quizzes = await db.collection('quizzes').find({
      courseVersionId: new ObjectId('6a50cb21b59da603242f22ac'),
    }).toArray();
    for (const q of quizzes) {
      console.log(`  • ${q._id}  name=${q.name}  itemsGroupId=${q.itemsGroupId?.toString?.() ?? q.itemsGroupId}`);
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();