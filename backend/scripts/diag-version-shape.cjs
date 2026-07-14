#!/usr/bin/env node
// diag-version-shape.cjs — Dump the courseVersion payload as the backend API returns it
// (the shape the frontend actually sees at useCourseVersionById)

const mongoose = null; // ignore
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
    console.log('│  COURSE VERSION PAYLOAD SHAPE                                 │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    if (!version) {
      console.log('❌ Version not found');
      return;
    }

    console.log('Raw version doc keys:', Object.keys(version));
    console.log('\nmodules array length:', version.modules?.length);
    if (version.modules) {
      for (const m of version.modules) {
        console.log(`\n--- Module: ${m.moduleId} (${m.name}) ---`);
        console.log('keys:', Object.keys(m));
        console.log('sections count:', m.sections?.length);
        if (m.sections) {
          for (const s of m.sections) {
            console.log(`  • section ${s.order}: id=${s.sectionId} itemsGroupId=${s.itemsGroupId}`);
          }
        }
      }
    }

    // What the frontend usually expects based on openapi.json
    // Let's see how sections are hydrated — they may come from newSection collection
    console.log('\n\n=== Hydrated sections (from newSection collection) ===');
    const sectionIds = (version.modules?.[0]?.sections || []).map((s) => s.sectionId);
    const sections = await db.collection('newSection')
      .find({ _id: { $in: sectionIds.map(id => new ObjectId(id)) } })
      .toArray();
    for (const s of sections) {
      console.log(`\n  Section ${s._id}: ${s.name} (itemsGroupId=${s.itemsGroupId})`);

      // Hydrate itemsGroup
      if (s.itemsGroupId) {
        const ig = await db.collection('itemsGroup').findOne({ _id: new ObjectId(s.itemsGroupId) });
        console.log(`    itemsGroup:`, JSON.stringify(ig, null, 4));
      }
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();