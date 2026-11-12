import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');

  const videoId = new ObjectId('6a65a37caa7ac66d3c160f50');

  // Let's first set it to false
  await db.collection('videos').updateOne(
    { _id: videoId },
    { $set: { 'details.isLensEnabled': false } }
  );

  let video = await db.collection('videos').findOne({ _id: videoId });
  console.log('Video after setting isLensEnabled to false:', JSON.stringify(video, null, 2));

  // Let's set it back to true
  await db.collection('videos').updateOne(
    { _id: videoId },
    { $set: { 'details.isLensEnabled': true } }
  );

  video = await db.collection('videos').findOne({ _id: videoId });
  console.log('Video after setting isLensEnabled to true:', JSON.stringify(video, null, 2));

  await client.close();
}

main().catch(console.error);
