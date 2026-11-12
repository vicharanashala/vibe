import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const courses = await db.collection('courses').find({}).toArray();
  console.log('Courses count:', courses.length);
  
  const items = await db.collection('items').find({ type: 'VIDEO' }).toArray();
  console.log('Video Items count:', items.length);
  for (const item of items) {
    console.log(`- Item Name: "${item.name}", URL: "${item.details?.URL || item.URL || ''}"`);
  }
  
  await client.close();
}

main().catch(console.error);
