// diag-enrollments-api.cjs — simulate the exact /users/enrollments aggregation
const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_ID = '6a46ec683f01733f189df8a3';

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  const userObjectId = new ObjectId(LEARNER_ID);

  console.log('=== Trying aggregation pipeline with role=STUDENT ===');
  const pipelineStudent = [
    {
      $match: {
        userId: { $in: [userObjectId, LEARNER_ID] },
        role: 'STUDENT',
        isDeleted: { $ne: true },
        status: 'ACTIVE',
      },
    },
  ];
  const rStudent = await db.collection('enrollment').aggregate(pipelineStudent).toArray();
  console.log('Count (role=STUDENT): ' + rStudent.length);
  for (const r of rStudent) console.log('  ' + r._id + ' course=' + r.courseId + ' status=' + r.status);

  console.log('\n=== Trying with role=undefined ===');
  const pipelineNone = [
    {
      $match: {
        userId: { $in: [userObjectId, LEARNER_ID] },
        isDeleted: { $ne: true },
        status: 'ACTIVE',
      },
    },
  ];
  const rNone = await db.collection('enrollment').aggregate(pipelineNone).toArray();
  console.log('Count (no role): ' + rNone.length);
  for (const r of rNone) console.log('  ' + r._id + ' course=' + r.courseId + ' status=' + r.status);

  console.log('\n=== Trying as plain find query ===');
  const rFind = await db.collection('enrollment').find({
    userId: userObjectId,
    role: 'STUDENT',
    isDeleted: { $ne: true },
    status: 'ACTIVE',
  }).toArray();
  console.log('Count (find STUDENT): ' + rFind.length);
  for (const r of rFind) console.log('  ' + r._id + ' course=' + r.courseId);

  console.log('\n=== Trying as plain find query (no role filter) ===');
  const rFind2 = await db.collection('enrollment').find({
    userId: userObjectId,
    isDeleted: { $ne: true },
  }).toArray();
  console.log('Count (find no role): ' + rFind2.length);
  for (const r of rFind2) console.log('  ' + r._id + ' course=' + r.courseId + ' role=' + r.role + ' status=' + r.status);

  console.log('\n=== The actual userId values stored in our enrollment ===');
  const all = await db.collection('enrollment').find({}).toArray();
  for (const e of all) {
    console.log('  _id=' + e._id + ' userId=' + e.userId + ' (typeof ' + typeof e.userId + ') course=' + e.courseId);
  }

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });