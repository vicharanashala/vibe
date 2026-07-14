/**
 * diag-collection-names.cjs
 *
 * Definitive check: list ALL collections in the vibe DB and show document
 * counts for the test course/version/course_registrations/enrollment.
 *
 * Critical: getBasicEnrollments uses 'newCourse' and 'newCourseVersion'.
 * If those collections are empty, the $unwind on 'course' DROPS the doc.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const url = process.env.MONGO_URI_OVERRIDE || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGO_DB_NAME || 'vibe';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(dbName);

  console.log('=== DB:', dbName, '@', url, '===');

  // Force materialize by inserting a probe
  try {
    await db.collection('diag_probe').insertOne({ _id: 'probe', ts: new Date() });
    await db.collection('diag_probe').deleteOne({ _id: 'probe' });
  } catch (e) {
    console.log('probe insert failed:', e.message);
  }

  // List all collections
  const collections = await db.listCollections().toArray();
  console.log('');
  console.log('=== All collections (' + collections.length + ') ===');
  for (const c of collections) {
    let count = '?';
    try {
      count = await db.collection(c.name).countDocuments();
    } catch (e) {
      count = '(err: ' + e.message.slice(0, 40) + ')';
    }
    console.log(`  ${c.name.padEnd(35)} ${count}`);
  }
  console.log('');

  // Check the test course/version in BOTH possible collection names
  const testCourseId = new ObjectId('6a50cb21b59da603242f22ab');
  const testVersionId = new ObjectId('6a50cb21b59da603242f22ac');

  for (const colName of ['courses', 'newCourse']) {
    const doc = await db.collection(colName).findOne({ _id: testCourseId });
    console.log(`=== ${colName}.findOne(testCourseId) ===`);
    if (doc) {
      console.log('  Found! name:', doc.name, '| versions count:', doc.versions?.length || 0);
      console.log('  versions:', doc.versions?.map(v => v?.toString?.() || v));
    } else {
      console.log('  NOT FOUND');
    }
    console.log('');
  }

  for (const colName of ['courseVersion', 'newCourseVersion']) {
    const doc = await db.collection(colName).findOne({ _id: testVersionId });
    console.log(`=== ${colName}.findOne(testVersionId) ===`);
    if (doc) {
      console.log('  Found! modules:', doc.modules?.length || 0);
      console.log('  versionStatus:', doc.versionStatus);
      console.log('  courseId:', doc.courseId?.toString());
    } else {
      console.log('  NOT FOUND');
    }
    console.log('');
  }

  // Run the FULL getBasicEnrollments pipeline with the ACTUAL collection names
  console.log('=== Replicating getBasicEnrollments with real collection names ===');
  const userObjectId = new ObjectId('6a46ec683f01733f189df8a3');
  const pipeline = [
    {
      $match: {
        userId: { $in: [userObjectId, '6a46ec683f01733f189df8a3'] },
        role: 'STUDENT',
        isDeleted: { $ne: true },
        status: { $regex: /^active$/i },
      },
    },
    { $sort: { enrollmentDate: -1 } },
    {
      $lookup: {
        from: 'progress',
        let: { userId: '$userId', courseId: '$courseId', courseVersionId: '$courseVersionId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$userId'] },
                  { $eq: ['$courseId', '$$courseId'] },
                  { $eq: ['$courseVersionId', '$$courseVersionId'] },
                  { $eq: ['$status', 'active'] },
                ],
              },
            },
          },
        ],
        as: 'progress',
      },
    },
    { $unwind: { path: '$progress', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'newCourse',
        localField: 'courseId',
        foreignField: '_id',
        as: 'course',
        pipeline: [{ $project: { name: 1, description: 1, updatedAt: 1 } }],
      },
    },
    { $unwind: '$course' },
    {
      $lookup: {
        from: 'newCourseVersion',
        localField: 'courseVersionId',
        foreignField: '_id',
        as: 'courseVersion',
        pipeline: [
          {
            $project: {
              totalItems: 1,
              itemCounts: 1,
              supportLink: 1,
              version: 1,
              description: 1,
              modules: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: '$courseVersion', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'cohorts',
        localField: 'cohortId',
        foreignField: '_id',
        as: 'cohort',
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: '$cohort', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        courseId: 1,
        courseVersionId: 1,
        role: 1,
        status: 1,
        enrollmentDate: 1,
        course: 1,
        courseVersion: 1,
        percentCompleted: { $ifNull: ['$percentCompleted', 0] },
        hasNewItemsAfterCompletion: { $ifNull: ['$hasNewItemsAfterCompletion', false] },
        cohortId: 1,
        cohortName: '$cohort.name',
      },
    },
  ];

  const result = await db.collection('enrollments').aggregate(pipeline).toArray();
  console.log('Pipeline result count:', result.length);
  result.forEach((r, i) => {
    console.log(`  [${i}]`, {
      _id: r._id?.toString(),
      courseId: r.courseId?.toString(),
      courseVersionId: r.courseVersionId?.toString(),
      courseName: r.course?.name,
      courseVersionModules: r.courseVersion?.modules?.length || 0,
      percentCompleted: r.percentCompleted,
      cohortName: r.cohortName,
    });
  });

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});