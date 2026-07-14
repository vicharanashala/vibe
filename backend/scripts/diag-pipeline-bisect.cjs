/**
 * diag-pipeline-bisect.cjs
 *
 * Bisect the getBasicEnrollments pipeline stage by stage to find WHERE the
 * doc is dropped. Output count after each stage.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

const USER_ID = '6a46ec683f01733f189df8a3';

(async () => {
  const url = process.env.MONGO_URI_OVERRIDE || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('vibe');
  const userObjectId = new ObjectId(USER_ID);

  // First check the raw enrollment doc
  console.log('=== Raw enrollment docs for test learner ===');
  const rawEnrollments = await db.collection('enrollments').find({ userId: userObjectId }).toArray();
  console.log('count:', rawEnrollments.length);
  rawEnrollments.forEach((e, i) => {
    console.log(`  [${i}] _id: ${e._id?.toString()}, status: "${e.status}", role: "${e.role}", isDeleted: ${e.isDeleted}, userId type: ${typeof e.userId} (${e.userId?.toString?.() || e.userId}), courseId: ${e.courseId?.toString?.()}, courseVersionId: ${e.courseVersionId?.toString?.()}, percentCompleted: ${e.percentCompleted}`);
  });
  console.log('');

  // Also check via string userId
  const rawByString = await db.collection('enrollments').find({ userId: USER_ID }).toArray();
  console.log('count (by string userId):', rawByString.length);
  console.log('');

  // Try matching all field combinations
  console.log('=== Variant queries ===');
  for (const q of [
    { userId: userObjectId, role: 'STUDENT', status: 'ACTIVE' },
    { userId: userObjectId, role: 'STUDENT' },
    { userId: userObjectId },
    { userId: USER_ID, role: 'STUDENT' },
    { userId: USER_ID },
    { userId: { $in: [userObjectId, USER_ID] }, role: 'STUDENT' },
    { userId: { $in: [userObjectId, USER_ID] }, role: 'STUDENT', status: 'ACTIVE' },
    { userId: { $in: [userObjectId, USER_ID] }, role: 'STUDENT', isDeleted: { $ne: true }, status: 'ACTIVE' },
    { userId: { $in: [userObjectId, USER_ID] }, role: 'STUDENT', isDeleted: { $ne: true }, status: { $regex: /^active$/i } },
    { userId: { $in: [userObjectId, USER_ID] }, role: 'STUDENT', isDeleted: { $ne: true }, status: { $regex: /^active$/i } },
  ]) {
    const c = await db.collection('enrollments').countDocuments(q);
    console.log('  count =', c, '| query:', JSON.stringify(q).slice(0, 200));
  }
  console.log('');

  // Now run the pipeline progressively — show count after each stage
  const stages = [
    { $match: { userId: { $in: [userObjectId, USER_ID] }, role: 'STUDENT', isDeleted: { $ne: true }, status: { $regex: /^active$/i } } },
    { $sort: { enrollmentDate: -1 } },
    { $lookup: { from: 'progress', let: { userId: '$userId', courseId: '$courseId', courseVersionId: '$courseVersionId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$userId', '$$userId'] }, { $eq: ['$courseId', '$$courseId'] }, { $eq: ['$courseVersionId', '$$courseVersionId'] }, { $eq: ['$status', 'active'] }] } } }], as: 'progress' } },
    { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'newCourse', localField: 'courseId', foreignField: '_id', as: 'course', pipeline: [{ $project: { name: 1, description: 1, updatedAt: 1 } }] } },
    { $unwind: '$course' },
    { $lookup: { from: 'newCourseVersion', localField: 'courseVersionId', foreignField: '_id', as: 'courseVersion', pipeline: [{ $project: { totalItems: 1, itemCounts: 1, supportLink: 1, version: 1, description: 1, modules: 1 } }] } },
    { $unwind: { path: '$courseVersion', preserveNullAndEmptyArrays: true } },
  ];

  console.log('=== Stage-by-stage bisect ===');
  let cumulative = [];
  for (let i = 0; i < stages.length; i++) {
    cumulative.push(stages[i]);
    const result = await db.collection('enrollments').aggregate(cumulative).toArray();
    const stageName = stages[i].$match ? '$match' : stages[i].$sort ? '$sort' : stages[i].$unwind ? `$unwind${stages[i].$unwind.preserveNullAndEmptyArrays ? ' (preserve)' : ' (strict)'}` : '$lookup';
    console.log(`Stage ${i + 1} [${stageName}]: count = ${result.length}`);
    if (result.length === 0 && i > 0) {
      console.log('  ⚠️ DROPPED HERE');
      break;
    }
    if (result.length > 0 && i === stages.length - 1) {
      result.forEach((r, idx) => {
        console.log(`  [${idx}]`, {
          _id: r._id?.toString(),
          courseId: r.courseId?.toString?.(),
          courseVersionId: r.courseVersionId?.toString?.(),
          courseName: r.course?.name,
          courseVersionModules: r.courseVersion?.modules?.length || 0,
        });
      });
    }
  }

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});