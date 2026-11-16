import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const targetUrl = 'https://www.youtube.com/watch?v=94BdnDVHrP0';
  
  const result = await db.collection('videos').updateMany({}, {
    $set: { 
      url: targetUrl, 
      URL: targetUrl,
      startTime: 0,
      endTime: 120, // Keep max duration to 2 minutes (120 seconds) as requested
      'details.URL': targetUrl,
      'details.startTime': "0",
      'details.endTime': "120"
    }
  });
  console.log(`Successfully updated ${result.modifiedCount} video documents to target React iNotebook course: ${targetUrl}`);
  
  await client.close();
}

main().catch(console.error);
