// The seed put items in a generic 'items' collection but never set the video
// source. The frontend Video component reads `details.URL` (uppercase), expects
// a YouTube URL, and uses YT IFrame API. With no URL, the embed loads an
// invalid videoId and shows a blank player.
//
// Fix: set `details: { URL, startTime, endTime, points }` on the videos
// collection doc. Idempotent — only updates if `details.URL` is missing OR if
// the URL is the legacy broken `dQw4w9WgXcQ` (Rickroll — embedding
// sometimes disabled on it).
const { MongoClient, ObjectId } = require('mongodb');

const VIDEO_ID = '6a4f774273de56bebbabd668';
// YouTube Developers' own "How to embed" demo (M7lc1UVf-VE) — embedding
// is guaranteed allowed because it's literally the IFrame API reference
// video. 3 minutes long, will be clipped to 1:00 by the player.
const YT_URL = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';

(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true');
  try {
    await client.connect();
    const db = client.db('vibe');
    const doc = await db.collection('videos').findOne({ _id: new ObjectId(VIDEO_ID) });
    if (!doc) {
      console.log(`videos.${VIDEO_ID} NOT FOUND — run fixup-typed-item-collections first`);
      process.exit(1);
    }
    if (doc.details && doc.details.URL === YT_URL) {
      console.log('videos.details.URL is already the working M7lc1UVf-VE:', doc.details.URL);
      console.log('  (nothing to do — change YT_URL above to swap)');
      return;
    }
    if (doc.details && doc.details.URL && doc.details.URL !== YT_URL) {
      console.log('Overwriting existing URL:', doc.details.URL, '->', YT_URL);
    }
    await db.collection('videos').updateOne(
      { _id: new ObjectId(VIDEO_ID) },
      { $set: {
        details: {
          URL: YT_URL,
          startTime: '00:00:00',
          endTime: '00:01:00',
          points: 10,
        },
      } },
    );
    const after = await db.collection('videos').findOne({ _id: new ObjectId(VIDEO_ID) });
    console.log('Updated. doc now:');
    console.log(JSON.stringify(after, null, 2));
  } finally {
    await client.close();
  }
})().catch(err => {
  console.error('[fixup-video-url] FAILED:', err);
  process.exit(1);
});