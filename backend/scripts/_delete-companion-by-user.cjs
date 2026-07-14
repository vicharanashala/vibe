const {MongoClient, ObjectId} = require('mongodb');

const USER_ID = '6a4b9f85cc68bde40897fc16';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const r = await db.collection('companions').deleteOne({userId: USER_ID});
  console.log('Companion doc deleted:', r.deletedCount > 0 ? 'yes' : 'no document found');

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });