import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const users = await db.collection('users').find({}).toArray();
  console.log(`Total users found: ${users.length}`);
  
  for (const user of users) {
    console.log(`- Email: ${user.email} | Name: ${user.name} | Role: ${user.role || user.roles}`);
  }
  
  await client.close();
}

main().catch(console.error);
