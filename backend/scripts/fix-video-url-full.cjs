#!/usr/bin/env node
// fix-video-url-full.cjs — Normalize video URL to full https:// format

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

    const items = await db.collection('items').find({ type: 'VIDEO' }).toArray();
    for (const item of items) {
      let url = item.details?.URL || '';
      // If URL is just an ID (e.g. "M7lc1UVf-VE"), wrap it in full YouTube URL
      if (url && !url.startsWith('http')) {
        url = `https://www.youtube.com/watch?v=${url}`;
        const r = await db.collection('items').updateOne(
          { _id: item._id },
          { $set: { 'details.URL': url, updatedAt: new Date() } },
        );
        console.log(`  ✓ ${item._id}: normalized to ${url}`);
      } else {
        console.log(`  - ${item._id}: URL already full: ${url}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();