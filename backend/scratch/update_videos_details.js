import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const result = await db.collection('videos').updateMany({}, {
    $set: { 
      url: '/videos/lecture.mp4', 
      URL: '/videos/lecture.mp4',
      'details.URL': '/videos/lecture.mp4'
    }
  });
  console.log(`Successfully updated ${result.modifiedCount} video documents' details.URL to local lecture.mp4!`);
  
  await client.close();
}

main().catch(console.error);
