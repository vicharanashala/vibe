const {MongoClient, ObjectId} = require('mongodb');
async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const enrollmentId = '6a53338a8dfcf921ee48e9f4';
  const panduIdObj = new ObjectId('6a4b8c7e1e6b7a91c33fb27c');

  // Fix: update userId from string to proper ObjectId
  const r = await db.collection('enrollments').updateOne(
    {_id: new ObjectId(enrollmentId)},
    {$set: {userId: panduIdObj}}
  );
  console.log('Matched:', r.matchedCount, 'Modified:', r.modifiedCount);

  // Verify
  const doc = await db.collection('enrollments').findOne({_id: new ObjectId(enrollmentId)});
  console.log('userId after fix:', doc.userId, '(type:', typeof doc.userId, ')');
  console.log('userId is ObjectId?', doc.userId instanceof ObjectId);

  // Also check if there are other enrollments with string userId that need fixing
  const stringUserIds = await db.collection('enrollments').find({
    userId: {$type: 'string'}
  }).toArray();
  console.log('\nOther enrollments with string userId:', stringUserIds.length);
  stringUserIds.forEach(e => console.log('  _id=', e._id, 'userId=', e.userId));

  await client.close();
  console.log('\nDone.');
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });