const {MongoClient, ObjectId} = require('mongodb');

const USER_ID = '6a4b9f85cc68bde40897fc16';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const uidObj = new ObjectId(USER_ID);

  // Find ALL docs in 'enrollment' collection that match either string or ObjectId userId
  const docs = await db.collection('enrollment').find({
    $or: [
      {userId: USER_ID},
      {userId: uidObj},
    ]
  }).toArray();

  console.log('Docs found in enrollment collection:', docs.length);
  docs.forEach(d => {
    console.log('  _id:', d._id.toString());
    console.log('  userId:', d.userId, '(type:', typeof d.userId, ', isObjectId?', d.userId instanceof ObjectId, ')');
    console.log('  role:', d.role);
    console.log('  status:', d.status);
    console.log('  percentCompleted:', d.percentCompleted);
    console.log('  isDeleted:', d.isDeleted);
    console.log('  createdAt:', d.createdAt);
    console.log('  enrollmentDate:', d.enrollmentDate);
    console.log('  ---');
  });

  // Also do a raw find without filters to see what exists
  const allDocs = await db.collection('enrollment').find({}).limit(5).toArray();
  console.log('\nFirst 5 docs in enrollment collection (no filter):');
  allDocs.forEach(d => {
    console.log('  _id:', d._id?.toString(), 'userId:', d.userId, 'role:', d.role);
  });

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });