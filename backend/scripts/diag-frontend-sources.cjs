// diag-frontend-sources.cjs — check what the frontend's "Enrolled" section reads
const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_ID = '6a46ec683f01733f189df8a3';
const COURSE_ID = '6a50cb21b59da603242f22ab';
const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  // Look in EVERY collection that might store enrollment state
  const colsToCheck = [
    'enrollment',
    'course_registrations',
    'enrollments',
    'newEnrollments',
    'newEnrollment',
    'newEnroll',
    'courseEnrollments',
    'user_courses',
    'progress',
    'user_progress',
    'userEnrollments',
    'studentEnrollments',
    'cohorts',
    'cohortMembers',
    'cohort_students',
    'cohort_memberships',
    'studentCohorts',
  ];

  for (const colName of colsToCheck) {
    const exists = await db.listCollections({ name: colName }).hasNext();
    if (!exists) continue;
    const docs = await db.collection(colName).find({
      $or: [
        { userId: new ObjectId(LEARNER_ID) },
        { studentId: new ObjectId(LEARNER_ID) },
        { learnerId: new ObjectId(LEARNER_ID) },
        { courseId: new ObjectId(COURSE_ID) },
        { courseVersionId: new ObjectId(VERSION_ID) },
      ],
    }).toArray();
    if (docs.length) {
      console.log('\n=== ' + colName + ' (' + docs.length + ' matches) ===');
      for (const d of docs) {
        console.log('  ' + JSON.stringify(d, null, 2));
      }
    }
  }

  // Also dump full cohort list to see if learner is in any
  console.log('\n=== All cohort-like collections ===');
  for (const colName of (await db.listCollections().toArray()).map(c => c.name)) {
    if (!/cohort/i.test(colName)) continue;
    const docs = await db.collection(colName).find({}).toArray();
    console.log('  ' + colName + ': ' + docs.length + ' docs');
    for (const d of docs.slice(0, 3)) {
      console.log('    ' + JSON.stringify(d, null, 2).slice(0, 500));
    }
  }

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });