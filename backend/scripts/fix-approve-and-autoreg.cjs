// fix-approve-and-autoreg.cjs
// 1) Print diagnostic state: pending registrations for test learner + version settings
// 2) Approve any PENDING registrations for the test learner in our test course
// 3) Enable auto-approval on the test courseVersion (if the field exists)

const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_EMAIL = 'test.learner@vibe.local';
const TEST_COURSE_NAME = 'Test Drive: Companion Demo';

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  // 1. Find learner
  const learner = await db.collection('users').findOne({ email: LEARNER_EMAIL });
  if (!learner) { console.error('No learner with email ' + LEARNER_EMAIL); process.exit(1); }
  console.log('Learner: ' + learner._id + ' (' + learner.email + ')');

  // 2. Find test course + version
  const course = await db.collection('newCourse').findOne({ name: TEST_COURSE_NAME });
  if (!course) {
    // fall back: any course whose name contains "Companion"
    const fallback = await db.collection('newCourse').findOne({ name: /Companion/i });
    if (fallback) {
      console.log('Test course not found by exact name; using fallback: ' + fallback.name);
    } else {
      console.error('No test course at all. Run seed-test-course.cjs first.');
      process.exit(1);
    }
  }
  const testCourse = course || fallback;
  console.log('Course: ' + testCourse._id + ' ("' + testCourse.name + '")');

  const version = await db.collection('newCourseVersion').findOne({ courseId: testCourse._id });
  if (!version) { console.error('No version for course ' + testCourse._id); process.exit(1); }
  console.log('Version: ' + version._id);

  // 3. Find pending registrations for this learner in this version
  const regCollectionNames = ['courseRegistration', 'newCourseRegistration', 'courseRegistrations', 'registrations'];
  let regCol = null;
  let regName = null;
  for (const n of regCollectionNames) {
    const exists = await db.listCollections({ name: n }).hasNext();
    if (exists) { regCol = db.collection(n); regName = n; break; }
  }
  if (!regCol) {
    console.error('No courseRegistration collection found. Tried: ' + regCollectionNames.join(', '));
    process.exit(1);
  }
  console.log('Reg collection: ' + regName);

  // Sample one doc to learn the schema
  const sample = await regCol.findOne({});
  if (sample) console.log('Sample reg doc keys: ' + Object.keys(sample).join(', '));

  // Find pending regs — try multiple field name conventions
  const studentId = learner._id;
  const queries = [
    { studentId: studentId, courseVersionId: version._id, status: 'PENDING' },
    { studentId: studentId, courseVersionId: version._id, status: 'pending' },
    { userId: studentId, courseVersionId: version._id, status: 'PENDING' },
    { userId: studentId, courseVersionId: version._id, status: 'pending' },
  ];
  let pending = [];
  for (const q of queries) {
    const found = await regCol.find(q).toArray();
    if (found.length) { pending = pending.concat(found); console.log('Matched query: ' + JSON.stringify(q) + ' (' + found.length + ')'); }
  }
  // Dedup
  pending = [...new Map(pending.map(p => [p._id.toString(), p])).values()];
  console.log('Pending regs to approve: ' + pending.length);

  // 4. Approve them
  for (const r of pending) {
    console.log('  Approving reg ' + r._id + ' (was status=' + r.status + ')');
    await regCol.updateOne(
      { _id: r._id },
      { $set: { status: 'APPROVED', updatedAt: new Date(), approvedAt: new Date() } },
    );
  }

  // 5. Enable auto-approval on the version (best effort)
  const autoApproveFields = ['autoApprove', 'autoApproval', 'auto_approve', 'autoApproveRegistration'];
  let currentAutoApprove = null;
  let autoApproveField = null;
  for (const f of autoApproveFields) {
    if (f in version) { currentAutoApprove = version[f]; autoApproveField = f; break; }
  }
  if (autoApproveField) {
    console.log('Auto-approval field: ' + autoApproveField + ' (current=' + currentAutoApprove + ')');
    if (!currentAutoApprove) {
      await db.collection('newCourseVersion').updateOne(
        { _id: version._id },
        { $set: { [autoApproveField]: true } },
      );
      console.log('  -> set ' + autoApproveField + '=true');
    } else {
      console.log('  -> already true, no change');
    }
  } else {
    console.log('No auto-approval field found on version. Fields: ' + Object.keys(version).join(', '));
    console.log('  (Auto-approval may be controlled by a separate settings doc.)');
  }

  // 6. Also check for a course registration settings doc
  const settingsCol = await db.listCollections({ name: 'courseRegistrationSettings' }).hasNext();
  if (settingsCol) {
    const settings = await db.collection('courseRegistrationSettings').findOne({ courseVersionId: version._id });
    console.log('courseRegistrationSettings for this version: ' + JSON.stringify(settings));
  }

  console.log('\nDONE. Refresh dashboard and you should be able to enter the course.');
  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); console.error(e); process.exit(1); });