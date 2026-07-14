const {MongoClient, ObjectId} = require('mongodb');
async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  // Find pandu (try email first, then name fallback)
  const user = await db.collection('users').findOne({email: /pandu/i}) ||
    await db.collection('users').findOne({firstName: /pandu/i}) ||
    await db.collection('users').findOne({email: /sahasra/i});
  if (!user) throw new Error('pandu user not found — have they logged in at least once?');
  console.log('Found user:', JSON.stringify(user));
  const userId = user._id;

  const courseId  = new ObjectId('6a53311b5b3a0f2ab44dc807');
  const versionId = new ObjectId('6a53311b5b3a0f2ab44dc808');
  const now = new Date();

  // Check existing enrollment
  const existing = await db.collection('enrollments').findOne({userId, courseId});
  if (existing) {
    console.log('Enrollment already exists:', JSON.stringify(existing));
  } else {
    const r = await db.collection('enrollments').insertOne({
      userId, courseId, courseVersionId: versionId,
      role: 'STUDENT', status: 'ACTIVE',
      enrollmentDate: now, percentCompleted: 0, completedItemsCount: 0,
      isDeleted: false, createdAt: now, updatedAt: now,
    });
    console.log('Enrollment inserted:', r.insertedId);
  }

  // Flip auto-approval so future registrations go through instantly
  const u = await db.collection('courseSettings').updateOne(
    {courseId},
    {$set: {
      'settings.registration.registrationsAutoApproved': true,
      'settings.registration.autoapproval_emails': []
    }}
  );
  console.log('courseSettings updated:', u.modifiedCount, 'document(s)');

  await client.close();
  console.log('Done. pandu userId =', userId.toString());
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });