const {MongoClient, ObjectId} = require('mongodb');
async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const enrollmentId = '6a53338a8dfcf921ee48e9f4';
  const panduUserId = '6a4b8c7e1e6b7a91c33fb27c';

  // ── 1. Confirm enrollment doc (for reference) ───────────────────────────
  const enrollment = await db.collection('enrollments').findOne({_id: new ObjectId(enrollmentId)});
  console.log('=== 1. Enrollment doc ===');
  console.log('userId type:', enrollment.userId.constructor.name);
  console.log('status:', enrollment.status, '/ type:', enrollment.status.constructor.name);
  console.log('role:', enrollment.role, '/ type:', enrollment.role.constructor.name);
  console.log('isDeleted:', enrollment.isDeleted, '/ type:', enrollment.isDeleted.constructor.name);

  // ── 2. The EXACT aggregation pipeline the dashboard uses ─────────────────
  console.log('\n=== 2. Dashboard aggregation pipeline (ObjectId userId) ===');
  const pipeline = [
    {$match: {
      userId: new ObjectId(panduUserId),
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: {$ne: true}
    }},
    {$sort: {enrollmentDate: -1}},
    {$lookup: {
      from: 'newCourse',
      localField: 'courseId',
      foreignField: '_id',
      as: 'course'
    }},
    {$unwind: {path: '$course', preserveNullAndEmptyArrays: true}},
    {$lookup: {
      from: 'newCourseVersion',
      localField: 'courseVersionId',
      foreignField: '_id',
      as: 'courseVersion'
    }},
    {$unwind: {path: '$courseVersion', preserveNullAndEmptyArrays: true}}
  ];

  const results = await db.collection('enrollments').aggregate(pipeline).toArray();
  console.log('Results count:', results.length);
  if (results.length > 0) {
    console.log('Found! _id:', results[0]._id, '| course:', results[0].course ? results[0].course.name : 'no course lookup');
  } else {
    console.log('NO RESULTS with ObjectId userId');
  }

  // ── 3. Same pipeline but with string userId (how a buggy API might call it) ─
  console.log('\n=== 3. Same pipeline with STRING userId ===');
  const strResults = await db.collection('enrollments').aggregate([
    {$match: {
      userId: panduUserId,  // string — no ObjectId wrapper
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: {$ne: true}
    }}
  ]).toArray();
  console.log('String userId results count:', strResults.length);
  if (strResults.length === 0) {
    console.log('-> String userId returns EMPTY — this would cause the "Available, not Enrolled" bug');
  }

  // ── 4. Check what userId type the API actually receives ──────────────────
  console.log('\n=== 4. Manual $expr test (BSON type-agnostic) ===');
  const exprResults = await db.collection('enrollments').find({
    $expr: {$and: [
      {$eq: [{$toString: '$userId'}, panduUserId]},
      {$eq: ['$role', 'STUDENT']},
      {$eq: ['$status', 'ACTIVE']},
      {$or: [{$eq: ['$isDeleted', false]}, {$eq: ['$isDeleted', null]}]}
    ]}
  }).toArray();
  console.log('$expr results count:', exprResults.length);
  if (exprResults.length > 0) {
    console.log('Found via $expr! _id:', exprResults[0]._id);
  }

  // ── 5. Check raw enrollments with string userId anywhere in the collection ─
  console.log('\n=== 5. All enrollments with string userId (type check) ===');
  const allEnrollments = await db.collection('enrollments').find({}).toArray();
  console.log('Total enrollments in DB:', allEnrollments.length);
  allEnrollments.forEach(e => {
    console.log('  _id:', e._id, '| userId:', e.userId, '(' + e.userId.constructor.name + ') | status:', e.status, '| isDeleted:', e.isDeleted);
  });

  await client.close();
  console.log('\nDone.');
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });