import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const versions = await db.collection('newCourseVersion').find({}).toArray();
  console.log('Course Versions count:', versions.length);
  for (const ver of versions) {
    console.log(`- Version: "${ver.name || 'Unnamed'}", ID: "${ver._id}"`);
    if (ver.sections) {
      for (const section of ver.sections) {
        if (section.items) {
          for (const item of section.items) {
            if (item.type === 'VIDEO') {
              console.log(`  - Video Item Name: "${item.name}", ID: "${item.itemId}", details URL: "${item.details?.URL || ''}", URL: "${item.URL || ''}"`);
            }
          }
        }
      }
    }
  }
  
  await client.close();
}

main().catch(console.error);
