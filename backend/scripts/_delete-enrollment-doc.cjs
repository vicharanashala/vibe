const {MongoClient, ObjectId} = require('mongodb');

const USER_ID = '6a4b9f85cc68bde40897fc16';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const uidObj = new ObjectId(USER_ID);

  // Delete by ObjectId from 'enrollment' collection (singular)
  const r = await db.collection('enrollment').deleteOne({
    userId: uidObj,
    role: 'STUDENT',
  });
  console.log('Deleted from enrollment collection:', r.deletedCount, 'document(s)');

  // Verify
  const remaining = await db.collection('enrollment').find({userId: uidObj}).toArray();
  console.log('Remaining in enrollment:', remaining.length);

  await client.close();
  console.log('Done.');
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });