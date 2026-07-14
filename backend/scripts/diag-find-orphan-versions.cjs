#!/usr/bin/env node
// diag-find-orphan-versions.cjs — Find orphaned itemsGroup/items/videos that might
// belong to our test course's sections but are missing the linkage.

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  ORPHAN COURSE CONTENT DIAGNOSTIC                            │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // All itemsGroups
    console.log('📦 ALL itemsGroup docs in DB:');
    const igs = await db.collection('itemsGroup').find({}).toArray();
    for (const ig of igs) {
      console.log(`  • _id=${ig._id.toString()}  courseVersionId=${ig.courseVersionId?.toString?.() ?? ig.courseVersionId}  name=${ig.name ?? '?'}`);
    }

    // All items
    console.log('\n📦 ALL items docs in DB (limit 20):');
    const its = await db.collection('items').find({}).limit(20).toArray();
    for (const it of its) {
      console.log(`  • _id=${it._id.toString()}  courseVersionId=${it.courseVersionId?.toString?.() ?? it.courseVersionId}  itemsGroupId=${it.itemsGroupId?.toString?.() ?? it.itemsGroupId}  type=${it.type}  name=${it.name ?? '?'}`);
    }
    console.log(`  (total items: ${await db.collection('items').countDocuments()})`);

    // All videos
    console.log('\n📦 ALL videos docs in DB:');
    const vs = await db.collection('videos').find({}).toArray();
    for (const v of vs) {
      console.log(`  • _id=${v._id.toString()}  courseVersionId=${v.courseVersionId?.toString?.() ?? v.courseVersionId}  itemsGroupId=${v.itemsGroupId?.toString?.() ?? v.itemsGroupId}  title=${v.title ?? v.name ?? '?'}`);
    }

    // All sections
    console.log('\n📦 ALL sections:');
    const ss = await db.collection('newSection').find({}).toArray();
    for (const s of ss) {
      console.log(`  • _id=${s._id.toString()}  courseVersionId=${s.courseVersionId?.toString?.() ?? s.courseVersionId}  itemsGroupId=${s.itemsGroupId?.toString?.() ?? s.itemsGroupId}  name=${s.name}`);
    }

    // All quizzes
    console.log('\n📦 ALL quizzes:');
    const qs = await db.collection('quizzes').find({}).toArray();
    for (const q of qs) {
      console.log(`  • _id=${q._id.toString()}  courseVersionId=${q.courseVersionId?.toString?.() ?? q.courseVersionId}  itemsGroupId=${q.itemsGroupId?.toString?.() ?? q.itemsGroupId}  title=${q.title}`);
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();