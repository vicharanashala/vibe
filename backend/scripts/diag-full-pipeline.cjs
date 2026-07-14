// diag-full-pipeline.cjs — run the EXACT aggregation pipeline the backend uses
// for getBasicEnrollments to see which stage drops the enrollment.

const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_ID = '6a46ec683f01733f189df8a3';

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');
  const userObjectId = new ObjectId(LEARNER_ID);

  const pipeline = [
    {
      $match: {
        userId: { $in: [userObjectId, LEARNER_ID] },
        role: 'STUDENT',
        isDeleted: { $ne: true },
        status: { $regex: /^active$/i },
      },
    },
    { $sort: { enrollmentDate: -1 } },
    // from progress
    {
      $lookup: {
        from: 'progress',
        let: {
          userId: '$userId',
          courseId: '$courseId',
          courseVersionId: '$courseVersionId',
        },
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
            $project: {
              currentModule: 1,
              currentSection: 1,
              currentItem: 1,
            },
          },
        ],
        as: 'progress',
      },
    },
    {
      $unwind: { path: '$progress', preserveNullAndEmptyArrays: true },
    },
    // Course lookup
    {
      $lookup: {
        from: 'newCourse',
        localField: 'courseId',
        foreignField: '_id',
        as: 'course',
        pipeline: [{ $project: { name: 1, description: 1, updatedAt: 1 } }],
      },
    },
    { $unwind: '$course' },  // ← this one is strict
    // CourseVersion lookup
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
    // itemsGroup lookup
    {
      $lookup: {
        from: 'itemsGroup',
        let: { sectionId: '$progress.currentSection' },
        pipeline: [
          { $match: { $expr: { $eq: ['$sectionId', '$$sectionId'] } } },
          { $project: { items: 1 } },
        ],
        as: 'itemsGroup',
      },
    },
    // final shape
    {
      $project: {
        _id: 1,
        courseId: 1,
        courseVersionId: 1,
        role: 1,
        status: 1,
        enrollmentDate: 1,
        courseName: '$course.name',
        courseVersionExists: { $cond: [{ $ifNull: ['$courseVersion', false] }, true, false] },
        itemsGroupCount: { $size: '$itemsGroup' },
        progressSection: '$progress.currentSection',
        moduleCount: { $size: '$courseVersion.modules' },
      },
    },
  ];

  console.log('=== Running aggregation pipeline (getBasicEnrollments sim) ===\n');
  const results = await db.collection('enrollment').aggregate(pipeline).toArray();

  console.log('Documents after full pipeline: ' + results.length + '\n');
  for (const r of results) {
    console.log('  _id: ' + r._id);
    console.log('  courseId: ' + r.courseId + ' (typeof ' + typeof r.courseId + ')');
    console.log('  courseVersionId: ' + r.courseVersionId);
    console.log('  courseName: ' + r.courseName);
    console.log('  courseVersionExists: ' + r.courseVersionExists);
    console.log('  itemsGroupCount: ' + r.itemsGroupCount);
    console.log('  moduleCount: ' + r.moduleCount);
    console.log('  progressSection: ' + r.progressSection);
  }

  // Also try the lookup individually to isolate the failure
  console.log('\n=== Isolating course lookup ===');
  const enr = await db.collection('enrollment').findOne({ _id: new ObjectId('6a50cd31b8ec5d23f45acc47') });
  console.log('Enrollment:');
  console.log('  courseId: ' + enr.courseId + ' (typeof ' + typeof enr.courseId + ')');
  console.log('  courseVersionId: ' + enr.courseVersionId);
  console.log('  courseId.isObjectId: ' + (enr.courseId instanceof ObjectId));

  const course = await db.collection('newCourse').findOne({ _id: enr.courseId });
  console.log('\nnewCourse lookup with enr.courseId: ' + (course ? 'FOUND ' + course.name : 'NOT FOUND'));

  const course2 = await db.collection('newCourse').findOne({ _id: new ObjectId('6a50cb21b59da603242f22ab') });
  console.log('newCourse lookup with hardcoded ObjectId: ' + (course2 ? 'FOUND ' + course2.name : 'NOT FOUND'));

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });