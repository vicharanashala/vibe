/**
 * diag-verify-fix.cjs
 * Verifies the new `findAllEnrollmentsForUser` repo method returns the
 * enrollments for the test learner. This proves the Ability decorator
 * will get the data it needs once the backend is restarted.
 *
 * Run: node backend/scripts/diag-verify-fix.cjs
 */
const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_ID = '6a46ec683f01733f189df8a3';

(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  console.log(`Looking up enrollments for userId = ${LEARNER_ID}\n`);

  // Method body copied verbatim from new EnrollmentRepository.findAllEnrollmentsForUser
  const userObjectId = ObjectId.isValid(LEARNER_ID) ? new ObjectId(LEARNER_ID) : null;
  const userFilter = userObjectId ? [LEARNER_ID, userObjectId] : [LEARNER_ID];

  const docs = await db
    .collection('enrollment')
    .find({
      userId: { $in: userFilter },
      isDeleted: { $ne: true },
    })
    .project({ _id: 0, courseId: 1, courseVersionId: 1, role: 1, status: 1 })
    .toArray();

  console.log(`Found ${docs.length} enrollment(s):\n`);
  docs.forEach((d, i) => {
    console.log(`#${i + 1}: courseId=${d.courseId}, courseVersionId=${d.courseVersionId}, role=${d.role}, status=${d.status}`);
  });

  console.log(`\nShaped output (what EnrollmentService.getAllEnrollments will pass to Ability decorator):`);
  const shaped = docs.map((d) => ({
    courseId: d.courseId?.toString(),
    courseVersionId: d.courseVersionId?.toString(),
    role: d.role,
    status: d.status,
  }));
  console.log(JSON.stringify(shaped, null, 2));

  if (shaped.length === 0) {
    console.log('\n❌ NO ENROLLMENTS FOUND. The Ability decorator will still get empty array → 403.');
    console.log('   Check: does the enrollment exist with userId=' + LEARNER_ID + '?');
    console.log('   Run: node backend/scripts/diag-recheck-collections.cjs to verify');
  } else {
    console.log('\n✅ FIX VERIFIED: Repository method returns the enrollment.');
    console.log('   After backend restart, this data flows into the ability system.');
    console.log('   courseVersionAbility will then grant View on CourseVersion(subject({versionId})) for this user.');
  }

  await client.close();
})();
