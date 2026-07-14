/**
 * diag-service-flow.cjs
 *
 * Runs the FULL backend service enrichment pipeline (mirrored from
 * EnrollmentService.ts getEnrollments) against raw MongoDB and prints
 * what the controller would return to the frontend.
 *
 * Why: we need to see the EXACT response shape that hits the frontend.
 * If empty array → bug confirmed in service logic.
 * If present → bug is in frontend (transport, parsing, or filter).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

const USER_ID = '6a46ec683f01733f189df8a3';

(async () => {
  const url = process.env.MONGO_URI_OVERRIDE || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGO_DB_NAME || 'vibe';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(dbName);

  console.log('=== DB:', dbName, '@', url, '===');
  console.log('=== USER_ID:', USER_ID, '===');
  console.log('');

  // ---- Step 1: replicate getBasicEnrollments aggregation ----
  const userObjectId = new ObjectId(USER_ID);

  const basicPipeline = [
    { $match: { userId: userObjectId, role: 'STUDENT', status: 'ACTIVE' } },
    {
      $lookup: {
        from: 'courseVersion',
        localField: 'courseVersionId',
        foreignField: '_id',
        as: 'courseVersion',
      },
    },
    { $unwind: { path: '$courseVersion', preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from: 'progresses',
        let: { uid: '$userId', cid: '$courseId', vid: '$courseVersionId', coid: '$cohortId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$uid'] },
                  { $eq: ['$courseId', '$$cid'] },
                  { $eq: ['$courseVersionId', '$$vid'] },
                  {
                    $or: [
                      { $eq: ['$cohortId', '$$coid'] },
                      { $eq: ['$cohortId', null] },
                      { $not: ['$$coid'] },
                    ],
                  },
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
        from: 'courses',
        localField: 'courseId',
        foreignField: '_id',
        as: 'course',
      },
    },
    { $unwind: { path: '$course', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        course: { name: 1, description: 1, updatedAt: 1 },
      },
    },
  ];

  const enrollments = await db.collection('enrollments').aggregate(basicPipeline).toArray();

  console.log('=== Step 1: getBasicEnrollments ===');
  console.log('count:', enrollments.length);
  enrollments.forEach((r, i) => {
    console.log(`  [${i}]`, {
      _id: r._id?.toString(),
      userId: r.userId?.toString(),
      courseId: r.courseId?.toString(),
      courseVersionId: r.courseVersionId?.toString(),
      role: r.role,
      status: r.status,
      percentCompleted: r.percentCompleted,
      totalItems: r.totalItems,
      course: r.course,
    });
  });
  console.log('');

  if (enrollments.length === 0) {
    console.log('!!! ABORT: getBasicEnrollments returned 0 rows !!!');
    await client.close();
    return;
  }

  // ---- Step 2: getActiveVersions ----
  const enrolledVersionIds = enrollments.map(e => e.courseVersionId);
  const courseVersions = await db
    .collection('courseVersion')
    .find({ _id: { $in: enrolledVersionIds } })
    .toArray();

  console.log('=== Step 2: getActiveVersions (matches _id in enrollments) ===');
  console.log('count:', courseVersions.length);
  courseVersions.forEach(v => {
    console.log('  version:', {
      _id: v._id.toString(),
      versionStatus: v.versionStatus,
      modules: v.modules?.length || 0,
      courseId: v.courseId?.toString(),
    });
  });
  console.log('');

  const activeVersionIds = new Set(courseVersions.map(v => v._id.toString()));
  const activeEnrollments = enrollments.filter(enr =>
    activeVersionIds.has(enr.courseVersionId.toString()),
  );

  console.log('=== Step 3: activeEnrollments (after filter) ===');
  console.log('count:', activeEnrollments.length);
  console.log('');

  if (activeEnrollments.length === 0) {
    console.log('!!! ABORT: activeEnrollments is empty after getActiveVersions filter !!!');
    await client.close();
    return;
  }

  // ---- Step 4: getWatchedItemCountsBatch ----
  const watchedKeys = enrollments.map(e => ({
    userId: new ObjectId(USER_ID),
    courseId: new ObjectId(e.courseId),
    courseVersionId: new ObjectId(e.courseVersionId),
    cohortId: e.cohortId,
  }));
  console.log('=== Step 4: getWatchedItemCountsBatch ===');
  console.log('keys:', watchedKeys.length);
  console.log('keys:', watchedKeys.map(k => `${USER_ID}-${k.courseId.toString()}-${k.courseVersionId.toString()}-${k.cohortId?.toString() || ''}`));
  // We'll simulate what getWatchedItemCountsBatch returns for our key:
  const watchedKey = `${USER_ID}-${activeEnrollments[0].courseId.toString()}-${activeEnrollments[0].courseVersionId.toString()}-${activeEnrollments[0].cohortId?.toString() || ''}`;
  const watchTimeForKey = await db.collection('watchTime').find({ key: watchedKey }).toArray();
  const progressForKey = await db.collection('progresses').find({
    userId: userObjectId,
    courseId: activeEnrollments[0].courseId,
    courseVersionId: activeEnrollments[0].courseVersionId,
  }).toArray();
  console.log('watchTime entries for key:', watchTimeForKey.length);
  console.log('progresses entries for user/course/version:', progressForKey.length);
  console.log('');

  // ---- Step 5: course-level lookup for `versions` field (used in filterCourseVersions) ----
  const coursesWithVersions = await db
    .collection('courses')
    .find({ _id: { $in: activeEnrollments.map(e => e.courseId) } })
    .project({ _id: 1, name: 1, versions: 1 })
    .toArray();

  console.log('=== Step 5: courses (with `versions` field) ===');
  coursesWithVersions.forEach(c => {
    console.log('  course:', {
      _id: c._id.toString(),
      name: c.name,
      versions: c.versions?.map(v => v?.toString()) || '(missing)',
    });
  });
  console.log('');

  // ---- Step 6: replicate filterCourseVersions and final enrichment ----
  const filterCourseVersions = (course, enrolledSet) => {
    return {
      ...course,
      versions: course?.versions
        ? course.versions
            .map(v => (v && typeof v === 'object' ? v : new ObjectId(String(v))))
            .filter(vId => enrolledSet.has(vId.toString()))
        : [],
    };
  };

  const final = activeEnrollments.map(enr => {
    const course = coursesWithVersions.find(
      c => c._id.toString() === enr.courseId.toString(),
    );
    return {
      _id: enr._id.toString(),
      courseId: enr.courseId.toString(),
      courseVersionId: enr.courseVersionId.toString(),
      role: enr.role,
      status: enr.status,
      enrollmentDate: enr.enrollmentDate,
      course: filterCourseVersions(course, activeVersionIds),
      percentCompleted: enr.percentCompleted || 0,
      contentCounts: { totalItems: enr.totalItems ?? 0 },
      cohortId: enr.cohortId?.toString(),
      completedItems: 0,
    };
  });

  console.log('=== Step 6: FINAL enriched enrollments (what controller returns) ===');
  console.log(JSON.stringify(final, null, 2));
  console.log('');

  console.log('=== Controller response shape ===');
  console.log(JSON.stringify({
    totalDocuments: final.length,
    totalPages: 1,
    currentPage: 1,
    enrollments: final,
    activeCount: final.length,
    archivedCount: 0,
  }, null, 2));

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});