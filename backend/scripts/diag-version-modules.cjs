#!/usr/bin/env node
// diag-version-modules.cjs — Show full modules array

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

    const version = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    console.log(JSON.stringify(version.modules, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();