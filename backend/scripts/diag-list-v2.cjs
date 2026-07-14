// diag-list-v2.cjs — clean listing using the same connection string as the seed
const { MongoClient } = require('mongodb');

const TEST_COURSE_NAME = 'Test Drive: Companion Demo';
const LEARNER_EMAIL = 'test.learner@vibe.local';

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  // Course
  const course = await db.collection('newCourse').findOne({ name: TEST_COURSE_NAME });
  console.log('Test course: ' + (course ? course._id + ' ("' + course.name + '")' : 'MISSING'));
  if (course) {
    const version = await db.collection('newCourseVersion').findOne({ courseId: course._id });
    console.log('  Version: ' + (version ? version._id : 'MISSING'));

    const modules = await db.collection('newModule').countDocuments({ courseId: course._id });
    const sections = await db.collection('newSection').countDocuments({ courseVersionId: version?._id });
    const itemsGroups = await db.collection('itemsGroup').countDocuments({});
    const videos = await db.collection('videos').countDocuments({});
    const quizzes = await db.collection('quizzes').countDocuments({});
    const items = await db.collection('items').countDocuments({});
    console.log('  Modules:    ' + modules);
    console.log('  Sections:   ' + sections);
    console.log('  itemsGroup: ' + itemsGroups);
    console.log('  videos:     ' + videos);
    console.log('  quizzes:    ' + quizzes);
    console.log('  items:      ' + items);

    // Show version modules[]
    if (version) {
      console.log('  version.modules[] count: ' + (Array.isArray(version.modules) ? version.modules.length : 'not an array'));
      if (Array.isArray(version.modules)) {
        for (const m of version.modules) {
          console.log('    module ' + (m.moduleId || '?') + ' — sections: ' + (Array.isArray(m.sections) ? m.sections.length : '?'));
          if (Array.isArray(m.sections)) {
            for (const s of m.sections) {
              console.log('      section ' + (s.sectionId || s._id || '?') + ' — name="' + (s.name || '?') + '" itemsGroupId=' + s.itemsGroupId);
            }
          }
        }
      }
    }
  }

  // Learner
  const learner = await db.collection('users').findOne({ email: LEARNER_EMAIL });
  console.log('\nLearner: ' + (learner ? learner._id + ' (' + learner.email + ')' : 'MISSING'));

  // Course registrations
  const regs = await db.collection('course_registrations').find({}).toArray();
  console.log('\nCourse registrations: ' + regs.length);
  for (const r of regs) {
    console.log('  ' + r._id + ' studentId=' + r.studentId + ' version=' + r.courseVersionId + ' status=' + r.status);
  }

  // Enrollments
  const enrolls = await db.collection('enrollment').find({}).toArray();
  console.log('\nEnrollments: ' + enrolls.length);
  for (const e of enrolls) {
    console.log('  ' + e._id + ' user=' + e.userId + ' version=' + e.courseVersionId + ' role=' + e.role + ' pct=' + e.percentCompleted);
  }

  // Companions
  const companions = await db.collection('companions').find({}).toArray();
  console.log('\nCompanions: ' + companions.length);
  for (const x of companions) {
    console.log('  ' + x._id + ' user=' + x.userId + ' animal=' + x.animal + ' stage=' + x.stage + ' pct=' + x.percentCompleted);
  }

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });