const {MongoClient, ObjectId} = require('mongodb');

const USER_ID = '6a4b9f85cc68bde40897fc16';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const uid = ObjectId.createFromHexString(USER_ID);

  const user = await db.collection('users').findOne({_id: uid});
  console.log('Email:', user ? user.email : 'not found');
  console.log('First name:', user ? user.firstName : 'not found');

  const enrollments = await db.collection('enrollments').find({userId: USER_ID}).toArray();
  console.log('Enrollments:', enrollments.length);
  enrollments.forEach(e => {
    console.log('  _id:', e._id.toString(), 'courseId:', e.courseId, 'status:', e.status, 'pct:', e.percentCompleted);
    // Also look up course name
    db.collection('newCourse').findOne({_id: new ObjectId(e.courseId)}).then(c => {
      if (c) console.log('    course name:', c.title);
    });
  });

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });