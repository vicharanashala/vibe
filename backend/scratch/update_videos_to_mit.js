import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const videoUrl = 'https://archive.org/download/MIT6.0001F16/MIT6_0001F16_L01_512kb.mp4';
  
  const result = await db.collection('videos').updateMany({}, {
    $set: { 
      url: videoUrl, 
      URL: videoUrl,
      'details.URL': videoUrl
    }
  });
  console.log(`Successfully updated ${result.modifiedCount} video documents to stream MIT Python Lecture!`);
  
  await client.close();
}

main().catch(console.error);
