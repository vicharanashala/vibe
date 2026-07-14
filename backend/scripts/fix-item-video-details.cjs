#!/usr/bin/env node
// fix-item-video-details.cjs — Copy URL/startTime/endTime/points from videos collection
// into the items.details field, so the frontend Video player can load them.

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
    console.log('│  COPY VIDEO URL → ITEMS DETAILS                              │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // For each video item, find the matching video by _id and copy details
    const videoItems = await db.collection('items').find({ type: 'VIDEO' }).toArray();
    for (const item of videoItems) {
      const video = await db.collection('videos').findOne({ _id: item._id });
      if (!video) {
        console.log(`  ⚠ Item ${item._id.toString()}: no matching video in videos collection`);
        continue;
      }

      // Normalize URL field — accept either full URL or just ID
      let url = video.details?.URL || video.URL || '';
      if (url && !url.startsWith('http')) {
        url = `https://www.youtube.com/watch?v=${url}`;
      }

      const details = {
        URL: url,
        startTime: video.details?.startTime || video.startTime || '00:00:00',
        endTime: video.details?.endTime || video.endTime || '00:01:00',
        points: video.details?.points || video.points || 10,
      };

      const result = await db.collection('items').updateOne(
        { _id: item._id },
        {
          $set: {
            details,
            updatedAt: new Date(),
          },
        },
      );
      console.log(`  ✓ Item ${item._id.toString()} (${item.name}):`);
      console.log(`    URL=${details.URL}`);
      console.log(`    startTime=${details.startTime}, endTime=${details.endTime}, points=${details.points}`);
    }

    console.log('\n✅ Done. Video items now have details.URL for the player.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();