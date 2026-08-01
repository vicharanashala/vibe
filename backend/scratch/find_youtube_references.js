import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const name = col.name;
    const docs = await db.collection(name).find({
      $or: [
        { url: /youtube\.com|youtu\.be/i },
        { URL: /youtube\.com|youtu\.be/i },
        { 'details.URL': /youtube\.com|youtu\.be/i }
      ]
    }).toArray();
    if (docs.length > 0) {
      console.log(`Collection "${name}" has ${docs.length} documents referencing YouTube URLs!`);
    }
  }
  
  await client.close();
}

main().catch(console.error);
