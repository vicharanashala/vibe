/**
 * diag-real-pipeline.cjs
 *
 * Run the FULL getBasicEnrollments pipeline against the CORRECT collection
 * name ('enrollment' — singular, per EnrollmentRepository.ts:75).
 *
 * If this returns 1 doc → backend pipeline works. Bug is in enrichment or frontend.
 * If 0 → bug is in the pipeline itself.
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

  // Run FULL pipeline against 'enrollment' (singular)
  const pipeline = [
    {
      $match: {
        userId: { $in: [userObjectId, USER_ID] },
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
          {
            $project: { currentModule: 1, currentSection: 1, currentItem: 1 },
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
        moduleNumber: '$moduleNumber',
        sectionNumber: '$sectionNumber',
        itemType: '$currentItemObj.type',
        totalItems: { $ifNull: ['$courseVersion.totalItems', 0] },
        percentCompleted: { $ifNull: ['$percentCompleted', 0] },
        hasNewItemsAfterCompletion: { $ifNull: ['$hasNewItemsAfterCompletion', false] },
        cohortId: 1,
        cohortName: '$cohort.name',
      },
    },
  ];

  console.log('=== FULL getBasicEnrollments pipeline (against enrollment collection) ===');
  const result = await db.collection('enrollment').aggregate(pipeline).toArray();
  console.log('count:', result.length);
  result.forEach((r, i) => {
    const safe = (v) => (v && typeof v === 'object' && v.constructor?.name === 'ObjectId' ? v.toString() : v);
    console.log(`  [${i}]`, {
      _id: safe(r._id),
      courseId: safe(r.courseId),
      courseVersionId: safe(r.courseVersionId),
      role: r.role,
      status: r.status,
      course: r.course,
      courseVersionTotalItems: r.courseVersion?.totalItems,
      courseVersionModules: r.courseVersion?.modules?.length || 0,
      percentCompleted: r.percentCompleted,
      hasNewItemsAfterCompletion: r.hasNewItemsAfterCompletion,
      cohortId: safe(r.cohortId),
      cohortName: r.cohortName,
    });
  });

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});