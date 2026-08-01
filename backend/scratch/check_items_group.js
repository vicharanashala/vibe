import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const groups = await db.collection('itemsGroup').find({}).toArray();
  console.log('itemsGroup count:', groups.length);
  for (const group of groups) {
    console.log(`- Group ID: "${group._id}"`);
    if (group.items) {
      for (const item of group.items) {
        if (item.type === 'VIDEO') {
          console.log(`  - Video Item Name: "${item.name}", ID: "${item.itemId}", details URL: "${item.details?.URL || ''}", URL: "${item.URL || ''}"`);
        }
      }
    }
  }
  
  await client.close();
}

main().catch(console.error);
