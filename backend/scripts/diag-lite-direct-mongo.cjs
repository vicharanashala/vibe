// diag-lite-direct-mongo.cjs
// Tests the dashboard-endpoint pipeline by calling just the enrollment repo logic directly.
// This isolates backend logic from auth.

const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/vibe';

// Find user
(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const user = await db.collection('users').findOne({ email: 'test.learner@vibe.local' });
  if (!user) {
    console.error('Test learner not found');
    process.exit(1);
  }
  console.log('User:', { _id: user._id, email: user.email });
  const userId = user._id;

  // Direct query — basic enrollment count
  const directCount = await db.collection('enrollment').countDocuments({
    userId: { $in: [userId, userId.toString()] },
    role: 'STUDENT',
    isDeleted: { $ne: true },
    status: { $regex: /^active$/i },
  });
  console.log('\nDirect count of matching enrollments:', directCount);

  // What is the actual role and status in DB?
  const samples = await db.collection('enrollment').find({ userId: { $in: [userId, userId.toString()] } }).toArray();
  console.log('\nAll enrollments for this user (no filter):');
  samples.forEach(e => {
    console.log({
      _id: e._id.toString(),
      userId: e.userId?.toString?.() || e.userId,
      courseId: e.courseId?.toString?.() || e.courseId,
      courseVersionId: e.courseVersionId?.toString?.() || e.courseVersionId,
      role: e.role,
      status: e.status,
      isDeleted: e.isDeleted,
      percentCompleted: e.percentCompleted,
    });
  });

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
