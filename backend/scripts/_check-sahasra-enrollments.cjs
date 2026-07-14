const {MongoClient} = require('mongodb');

const USER_ID = '6a4b9f85cc68bde40897fc16';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const docs = await db.collection('enrollments').find({userId: USER_ID}).toArray();
  console.log('Enrollments found:', docs.length);
  docs.forEach(d => {
    console.log('  _id:', d._id.toString());
    console.log('  userId:', d.userId, '(type:', typeof d.userId, ')');
    console.log('  role:', d.role);
    console.log('  status:', d.status);
    console.log('  percentCompleted:', d.percentCompleted);
    console.log('  isDeleted:', d.isDeleted);
  });

  // Also check if there are any enrollments for this user as an ObjectId
  const {ObjectId} = require('mongodb');
  const docs2 = await db.collection('enrollments').find({userId: new ObjectId(USER_ID)}).toArray();
  console.log('\nEnrollments found (by ObjectId):', docs2.length);

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });