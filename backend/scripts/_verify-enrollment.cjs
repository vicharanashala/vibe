const {MongoClient, ObjectId} = require('mongodb');
async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const enrollmentId = '6a53338a8dfcf921ee48e9f4';
  const panduId = '6a4b8c7e1e6b7a91c33fb27c';
  const courseId = '6a53311b5b3a0f2ab44dc807';

  console.log('=== 1. Direct lookup by enrollment ID ===');
  const byId = await db.collection('enrollments').findOne({_id: new ObjectId(enrollmentId)});
  console.log('By ID:', JSON.stringify(byId, null, 2));

  console.log('\n=== 2. All enrollments for pandu ===');
  const allForPandu = await db.collection('enrollments').find({userId: new ObjectId(panduId)}).toArray();
  console.log('Count:', allForPandu.length);
  allForPandu.forEach((e, i) => {
    console.log(`  [${i}] _id=${e._id} courseId=${e.courseId} role=${e.role} status=${e.status} percentCompleted=${e.percentCompleted} enrollmentDate=${e.enrollmentDate}`);
  });

  console.log('\n=== 3. Check course settings for this course ===');
  const cs = await db.collection('courseSettings').findOne({courseId: new ObjectId(courseId)});
  console.log('courseSettings:', JSON.stringify(cs, null, 2));

  console.log('\n=== 4. Registration records for pandu + this course ===');
  const regs = await db.collection('registrations').find({
    userId: new ObjectId(panduId),
    courseId: new ObjectId(courseId)
  }).toArray();
  console.log('Registrations:', JSON.stringify(regs, null, 2));

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });