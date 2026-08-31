import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const doc = await db.collection('itemsGroup').findOne({});
  console.log('Full itemsGroup structure:', JSON.stringify(doc, null, 2));
  
  await client.close();
}

main().catch(console.error);
