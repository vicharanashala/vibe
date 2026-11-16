import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const videos = await db.collection('videos').find().toArray();
  console.log('Current video documents in DB:');
  console.log(JSON.stringify(videos, null, 2));
  
  await client.close();
}

main().catch(console.error);
