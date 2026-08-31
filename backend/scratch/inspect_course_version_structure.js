import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const doc = await db.collection('newCourseVersion').findOne({});
  console.log('Keys of newCourseVersion:', Object.keys(doc || {}));
  console.log('Full document structure:', JSON.stringify(doc, null, 2).slice(0, 1000));
  
  await client.close();
}

main().catch(console.error);
