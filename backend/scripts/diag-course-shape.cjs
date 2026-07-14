#!/usr/bin/env node
// diag-course-shape.cjs — Dump full structure of the test course + version
// Helps diagnose "Cannot read properties of undefined (reading 'length')"

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const COURSE_ID = '6a50cb21b59da603242f22ab';
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
    console.log('│  COURSE STRUCTURE DIAGNOSTIC                                  │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // 1. Course
    const course = await db.collection('newCourse').findOne({ _id: new ObjectId(COURSE_ID) });
    console.log('📦 COURSE (newCourse):');
    console.log(JSON.stringify(course, null, 2));

    // 2. Version
    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    console.log('\n📦 VERSION (newCourseVersion):');
    console.log(JSON.stringify(version, null, 2));

    // 3. Modules
    const modules = await db.collection('newModule').find({ courseVersionId: new ObjectId(VERSION_ID) }).toArray();
    console.log(`\n📦 MODULES (newModule): ${modules.length}`);
    for (const m of modules) {
      console.log(JSON.stringify(m, null, 2));
    }

    // 4. Sections
    const sections = await db.collection('newSection').find({ courseVersionId: new ObjectId(VERSION_ID) }).toArray();
    console.log(`\n📦 SECTIONS (newSection): ${sections.length}`);
    for (const s of sections) {
      console.log(JSON.stringify(s, null, 2));
    }

    // 5. ItemGroups
    const itemGroups = await db.collection('itemsGroup').find({ courseVersionId: new ObjectId(VERSION_ID) }).toArray();
    console.log(`\n📦 ITEM GROUPS (itemsGroup): ${itemGroups.length}`);
    for (const g of itemGroups) {
      console.log(JSON.stringify(g, null, 2));
    }

    // 6. Items
    const items = await db.collection('items').find({ courseVersionId: new ObjectId(VERSION_ID) }).toArray();
    console.log(`\n📦 ITEMS (items): ${items.length}`);
    for (const i of items) {
      console.log(JSON.stringify(i, null, 2));
    }

    // 7. Videos
    const videos = await db.collection('videos').find({ courseVersionId: new ObjectId(VERSION_ID) }).toArray();
    console.log(`\n📦 VIDEOS (videos): ${videos.length}`);
    for (const v of videos) {
      console.log(JSON.stringify(v, null, 2));
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();