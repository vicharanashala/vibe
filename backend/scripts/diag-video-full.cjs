#!/usr/bin/env node
// diag-video-full.cjs — Check what URL the videos have (and what the videos collection looks like)

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

    console.log('\n--- ALL VIDEOS ---');
    const videos = await db.collection('videos').find({}).toArray();
    for (const v of videos) {
      console.log(`\n_id=${v._id}`);
      console.log(JSON.stringify(v, null, 2));
    }

    console.log('\n--- VIDEO ITEMS (from items collection) ---');
    const items = await db.collection('items').find({ type: 'VIDEO' }).toArray();
    for (const it of items) {
      console.log(`\nitem _id=${it._id}`);
      console.log(JSON.stringify(it, null, 2));
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();