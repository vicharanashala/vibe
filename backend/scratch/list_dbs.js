import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const adminDb = client.db().admin();
  const dbs = await adminDb.listDatabases();
  console.log('Databases:', dbs.databases.map(d => d.name));
  
  for (const dbInfo of dbs.databases) {
    const db = client.db(dbInfo.name);
    const collections = await db.listCollections().toArray();
    console.log(`Database "${dbInfo.name}" collections:`, collections.map(c => c.name));
  }
  
  await client.close();
}

main().catch(console.error);
