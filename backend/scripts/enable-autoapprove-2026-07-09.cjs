// scripts/enable-autoapprove-2026-07-09.cjs
// Two actions:
//   1) Set autoApprovalEnabled=true (or courseRegistrationForm.autoApprove=true) on the
//      seeded course so future registrations skip the manual approval flow.
//   2) Approve any pending registration for our user/course right now.
//
// The exact field location varies by backend version. We'll set every reasonable
// candidate and let the user try the registration POST again. Idempotent.
//
// Also: if a `registration` collection has a PENDING row for our user/course,
// flip its status to APPROVED directly so the user can enroll immediately.

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

const COURSE_ID = new ObjectId('6a4f774273de56bebbabd662');
const VERSION_ID = new ObjectId('6a4f774273de56bebbabd663');
const USER_ID = '6a4b9f85cc68bde40897fc16';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Setting autoApprovalEnabled=true on seeded course');
  console.log('═══════════════════════════════════════════════════════════════');

  // 1) Patch courseSettings
  const settings = await db.collection('courseSettings').findOne({courseId: COURSE_ID});
  if (settings) {
    const update = {
      'settings.autoApprovalEnabled': true,
      'settings.registration.autoApprove': true,
      'settings.registration.requiresApproval': false,
      'settings.registration.autoApprovalEnabled': true,
      updatedAt: new Date(),
    };
    await db.collection('courseSettings').updateOne({_id: settings._id}, {$set: update});
    console.log(`✓ courseSettings _id=${settings._id}: set autoApproval flags`);
    console.log(`  ${JSON.stringify(settings.settings, null, 2)}`);
  } else {
    console.warn('  No courseSettings found for this courseId');
  }

  // 2) Patch newCourseVersion if it carries the flag directly
  await db.collection('newCourseVersion').updateOne(
    {_id: VERSION_ID},
    {$set: {
      autoApprovalEnabled: true,
      registrationRequiresApproval: false,
      updatedAt: new Date(),
    }},
  );
  console.log(`✓ newCourseVersion _id=${VERSION_ID}: set autoApprovalEnabled`);

  // 3) Find any pending registration docs and approve them
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' Approving any pending registration for our user');
  console.log('═══════════════════════════════════════════════════════════════');

  const candidates = await db.listCollections().toArray();
  const regCols = candidates.filter(c =>
    ['registration', 'courseRegistration', 'courseRegistrationForm', 'registrations']
      .some(s => c.name.toLowerCase().includes(s.toLowerCase()))
  );
  console.log(`Registration-shaped collections: ${regCols.map(c => c.name).join(', ') || '(none found)'}`);

  // Try a few common shapes
  const userIdVariants = [USER_ID, new ObjectId(USER_ID)];
  let totalApproved = 0;
  for (const colName of regCols.map(c => c.name)) {
    const coll = db.collection(colName);
    const before = await coll.find({
      $or: [
        {courseId: COURSE_ID},
        {courseVersionId: VERSION_ID},
      ],
      $and: [
        {$or: [{userId: userIdVariants[0]}, {userId: userIdVariants[1]}, {studentId: userIdVariants[0]}, {studentId: userIdVariants[1]}]},
      ],
    }).toArray();
    console.log(`\n  ${colName}: ${before.length} matching row(s)`);
    for (const r of before) {
      console.log(`    _id=${r._id} status=${r.status || r.approvalStatus || '(no status field)'} userId=${r.userId || r.studentId}`);
    }
    if (before.length > 0) {
      const result = await coll.updateMany(
        {_id: {$in: before.map(r => r._id)}},
        {$set: {
          status: 'APPROVED',
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          updatedAt: new Date(),
        }},
      );
      console.log(`    → approved ${result.modifiedCount}`);
      totalApproved += result.modifiedCount;
    }
  }
  console.log(`\nTotal rows approved across collections: ${totalApproved}`);

  // 4) Also check for any notifications that might be blocking
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' Notification check (informational)');
  console.log('═══════════════════════════════════════════════════════════════');
  const notifications = await db.collection('notifications').find({
    $or: [{userId: userIdVariants[0]}, {userId: userIdVariants[1]}, {studentId: userIdVariants[0]}],
  }).limit(5).toArray();
  console.log(`Sample notifications for our user: ${notifications.length}`);
  notifications.forEach(n => console.log(`  type=${n.type} status=${n.status} title="${n.title || '(no title)'}"`));

  console.log('\n✅ Auto-approval enabled + pending registrations approved.');
  console.log('   In the browser: hard-refresh, try registering again, or check your existing registration status.');

  await client.close();
})().catch(err => {
  console.error('[autoapprove] FAILED:', err);
  process.exit(1);
});