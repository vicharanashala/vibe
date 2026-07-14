#!/usr/bin/env node
// diag-verify-version.cjs — Verify what sections are actually in the version doc now

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

    console.log('\n--- CURRENT VERSION ---');
    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    if (!version) {
      console.log('Version not found');
      return;
    }
    console.log('modules[0].sections:');
    for (const s of version.modules?.[0]?.sections || []) {
      console.log(`  • order=${s.order}  sectionId=${s.sectionId}  itemsGroupId=${s.itemsGroupId}`);
    }

    console.log('\n--- SECTIONS IN DB ---');
    const sections = await db.collection('newSection').find({}).toArray();
    for (const s of sections) {
      console.log(`  • _id=${s._id}  name=${s.name}  courseVersionId=${s.courseVersionId?.toString?.() ?? s.courseVersionId}  itemsGroupId=${s.itemsGroupId?.toString?.() ?? s.itemsGroupId}`);
    }

    console.log('\n--- ITEMSGROUPS IN DB ---');
    const igs = await db.collection('itemsGroup').find({}).toArray();
    for (const ig of igs) {
      console.log(`  • _id=${ig._id}  courseVersionId=${ig.courseVersionId?.toString?.() ?? ig.courseVersionId}`);
    }

    console.log('\n--- ITEMS IN DB ---');
    const items = await db.collection('items').find({}).toArray();
    for (const it of items) {
      console.log(`  • _id=${it._id}  type=${it.type}  name=${it.name}  itemsGroupId=${it.itemsGroupId?.toString?.() ?? it.itemsGroupId}`);
    }

    console.log('\n--- QUIZZES IN DB ---');
    const quizzes = await db.collection('quizzes').find({}).toArray();
    for (const q of quizzes) {
      console.log(`  • _id=${q._id}  name=${q.name}  itemsGroupId=${q.itemsGroupId?.toString?.() ?? q.itemsGroupId}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();