// bootstrap-fresh-state.cjs
// Single command to set up a clean working test environment:
//   1. Re-create the test learner (test.learner@vibe.local) if missing
//   2. Wipe stale test-course registrations + enrollments
//   3. Diagnose the registration schema (find what field stores studentId)
//   4. Create a fresh registration for the test learner (status=APPROVED)
//   5. Create a fresh enrollment for the test learner (percentCompleted=0)
//   6. Create a fresh companion for the test learner (animal=panda)
//   7. Enable auto-approval on the test version
//   8. Print final state

const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_EMAIL = 'test.learner@vibe.local';
const LEARNER_ID = '6a46ec683f01733f189df8a3';
const TEST_COURSE_NAME = 'Test Drive: Companion Demo';

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  // 1. Find or create learner
  let learner = await db.collection('users').findOne({ email: LEARNER_EMAIL });
  if (!learner) {
    console.log('[1] Learner missing — creating');
    learner = {
      _id: new ObjectId(LEARNER_ID),
      email: LEARNER_EMAIL,
      firstName: 'Test',
      lastName: 'Learner',
      roles: ['STUDENT'],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await db.collection('users').insertOne(learner);
      console.log('    Created learner _id=' + learner._id);
    } catch (e) {
      console.log('    Insert with _id=' + LEARNER_ID + ' failed: ' + e.message);
      console.log('    Trying with auto-generated ObjectId');
      delete learner._id;
      const r = await db.collection('users').insertOne(learner);
      learner._id = r.insertedId;
      console.log('    Created learner _id=' + learner._id);
    }
  } else {
    console.log('[1] Learner exists _id=' + learner._id);
  }

  // 2. Find test course
  const course = await db.collection('newCourse').findOne({ name: TEST_COURSE_NAME });
  if (!course) { console.error('No test course — run reseed-and-fix.cjs first'); process.exit(1); }
  const version = await db.collection('newCourseVersion').findOne({ courseId: course._id });
  console.log('[2] Course=' + course._id + ' Version=' + version._id);

  // 3. Wipe stale registrations + enrollments for this course
  console.log('[3] Wiping stale registrations for this version');
  const regCol = db.collection('course_registrations');
  const staleRegs = await regCol.find({ courseVersionId: version._id }).toArray();
  console.log('    Found ' + staleRegs.length + ' stale regs');
  if (staleRegs.length) {
    // Show schema of one
    console.log('    Sample reg fields: ' + Object.keys(staleRegs[0]).join(', '));
    await regCol.deleteMany({ courseVersionId: version._id });
  }

  const enrCol = db.collection('enrollment');
  const staleEnrolls = await enrCol.find({ courseVersionId: version._id }).toArray();
  console.log('    Found ' + staleEnrolls.length + ' stale enrollments');
  if (staleEnrolls.length) {
    console.log('    Sample enr fields: ' + Object.keys(staleEnrolls[0]).join(', '));
    await enrCol.deleteMany({ courseVersionId: version._id });
  }

  // 4. Create fresh APPROVED registration
  console.log('[4] Creating fresh APPROVED registration');
  const newReg = {
    _id: new ObjectId(),
    studentId: learner._id,        // some schemas use userId, some studentId — try both
    userId: learner._id,
    courseId: course._id,
    courseVersionId: version._id,
    status: 'APPROVED',
    createdAt: new Date(),
    updatedAt: new Date(),
    approvedAt: new Date(),
  };
  await regCol.insertOne(newReg);
  console.log('    Inserted reg _id=' + newReg._id);

  // 5. Create fresh enrollment
  console.log('[5] Creating fresh enrollment');
  const newEnr = {
    _id: new ObjectId(),
    userId: learner._id,
    courseId: course._id,
    courseVersionId: version._id,
    role: 'STUDENT',
    status: 'ACTIVE',
    enrollmentDate: new Date(),
    percentCompleted: 0,
    completedItemsCount: 0,
    totalItemsCount: 4,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await enrCol.insertOne(newEnr);
  console.log('    Inserted enrollment _id=' + newEnr._id);

  // 6. Create fresh companion
  console.log('[6] Creating fresh companion');
  const compCol = db.collection('companions');
  await compCol.deleteMany({ userId: learner._id });  // wipe any old one for this user
  const newComp = {
    _id: new ObjectId(),
    userId: learner._id,
    animal: 'panda',
    stage: 0,
    percentCompleted: 0,
    mood: 'neutral',
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await compCol.insertOne(newComp);
  console.log('    Inserted companion _id=' + newComp._id);

  // 7. Enable auto-approval
  console.log('[7] Enabling auto-approval');
  await db.collection('newCourseVersion').updateOne(
    { _id: version._id },
    { $set: { autoApprove: true, auto_approve: true } },
  );

  // Also flip the registration.isActive flag
  await db.collection('courseSettings').updateOne(
    { courseVersionId: version._id },
    { $set: { 'settings.registration.isActive': true, 'settings.registration.autoApprove': true } },
  );

  // 8. Print final state
  console.log('\n=== FINAL STATE ===');
  console.log('Learner:    ' + learner._id + ' (' + learner.email + ')');
  console.log('Course:     ' + course._id + ' ("' + course.name + '")');
  console.log('Version:    ' + version._id);
  console.log('Reg:        ' + newReg._id + ' (APPROVED)');
  console.log('Enrollment: ' + newEnr._id);
  console.log('Companion:  ' + newComp._id + ' (panda, stage 0)');

  console.log('\n>>> Now hard-refresh dashboard and you should see:');
  console.log('    - Test course in Enrolled section (no approval needed)');
  console.log('    - Panda at stage 0 (Baby)');
  console.log('    - Watch video → progress updates → panda grows');
  console.log('    - Answer quiz (Fox correct) → 100% → Adult panda (stage 5)');
  console.log('    - Companion should NOT revert to Baby after 100%');

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); console.error(e); process.exit(1); });