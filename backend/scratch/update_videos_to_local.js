import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const videoUrl = '/videos/lecture.mp4';
  
  const result = await db.collection('videos').updateMany({}, {
    $set: { 
      url: videoUrl, 
      URL: videoUrl,
      'details.URL': videoUrl
    }
  });
  console.log(`Successfully updated ${result.modifiedCount} video documents back to local /videos/lecture.mp4!`);
  
  await client.close();
}

main().catch(console.error);
