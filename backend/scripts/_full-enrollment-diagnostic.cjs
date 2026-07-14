const {MongoClient, ObjectId} = require('mongodb');
async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const enrollmentId = '6a53338a8dfcf921ee48e9f4';
  const panduUserId = '6a4b8c7e1e6b7a91c33fb27c';

  // ── 1. Raw enrollment document with field types ──────────────────────────
  console.log('=== 1. Enrollment doc by _id ===');
  const enrollment = await db.collection('enrollments').findOne({_id: new ObjectId(enrollmentId)});
  if (!enrollment) {
    console.log('NOT FOUND');
    return;
  }
  console.log('userId value:', enrollment.userId);
  console.log('userId BSON type:', enrollment.userId.constructor.name);
  console.log('courseId value:', enrollment.courseId);
  console.log('courseId BSON type:', enrollment.courseId.constructor.name);
  console.log('courseVersionId value:', enrollment.courseVersionId);
  console.log('courseVersionId BSON type:', enrollment.courseVersionId.constructor.name);
  console.log('status value:', enrollment.status);
  console.log('status BSON type:', enrollment.status.constructor.name);
  console.log('role value:', enrollment.role);
  console.log('role BSON type:', enrollment.role.constructor.name);
  console.log('isDeleted value:', enrollment.isDeleted);
  console.log('isDeleted BSON type:', enrollment.isDeleted.constructor.name);
  console.log('Full doc:', JSON.stringify(enrollment, null, 2));

  // ── 2. Pandu user doc — byte-for-byte match check ────────────────────────
  console.log('\n=== 2. Pandu user doc ===');
  // Try both string and ObjectId forms
  const userByObj = await db.collection('users').findOne({_id: new ObjectId(panduUserId)});
  const userByStr = await db.collection('users').findOne({_id: panduUserId});
  console.log('User by ObjectId:', userByObj ? userByObj._id.toString() : 'NOT FOUND');
  console.log('User by string:', userByStr ? userByStr._id.toString() : 'NOT FOUND');
  console.log('userId in enrollment matches user _id (ObjectId)?', enrollment.userId.toString() === userByObj._id.toString());
  console.log('userId in enrollment matches user _id (string)?', enrollment.userId.toString() === userByStr._id.toString());
  if (userByObj) {
    console.log('Pandu user doc:', JSON.stringify(userByObj, null, 2));
  }

  // ── 3. Exact dashboard query — aggregation pipeline ──────────────────────
  console.log('\n=== 3. Dashboard enrollment query (aggregation) ===');
  const userIdObj = userByObj ? userByObj._id : new ObjectId(panduUserId);
  const dashboardPipeline = [
    {$match: {
      userId: userIdObj,
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
  const results = await db.collection('enrollments').aggregate(dashboardPipeline).toArray();
  console.log('Results count:', results.length);
  if (results.length > 0) {
    console.log('First result _id:', results[0]._id);
    console.log('First result course.name:', results[0].course ? results[0].course.name : 'N/A');
    console.log('Full first result:', JSON.stringify(results[0], null, 2));
  } else {
    console.log('NO RESULTS — dashboard will show empty enrolled list');
    // Debug: try with string userId
    console.log('\n--- Debug: same pipeline with string userId ---');
    const debugPipeline = [
      {$match: {
        userId: panduUserId,  // string, not ObjectId
        role: 'STUDENT',
        status: 'ACTIVE',
        isDeleted: {$ne: true}
      }}
    ];
    const debugResults = await db.collection('enrollments').aggregate(debugPipeline).toArray();
    console.log('String userId query results:', debugResults.length);
    if (debugResults.length > 0) {
      console.log('Found with string userId — this suggests the API is passing userId as a string not ObjectId');
    }
  }

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message, err.stack); process.exit(1); });