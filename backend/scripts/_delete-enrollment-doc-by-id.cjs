const {MongoClient, ObjectId} = require('mongodb');

// Delete by _id directly (known from the find output)
const DOC_ID = '6a50fe0e9850fcfc6ddf49a7';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  // First verify we can find it by _id
  const doc = await db.collection('enrollment').findOne({_id: new ObjectId(DOC_ID)});
  console.log('Found by _id:', doc ? 'YES - userId: ' + doc.userId + ' percentCompleted: ' + doc.percentCompleted : 'NO');

  // Delete by _id
  const r = await db.collection('enrollment').deleteOne({_id: new ObjectId(DOC_ID)});
  console.log('Deleted:', r.deletedCount, 'document(s)');

  // Verify gone
  const gone = await db.collection('enrollment').findOne({_id: new ObjectId(DOC_ID)});
  console.log('Still exists:', gone ? 'YES' : 'NO');

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });