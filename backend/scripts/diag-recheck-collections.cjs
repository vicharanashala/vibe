/**
 * diag-recheck-collections.cjs
 *
 * Re-check the state of all related collections for the test learner
 * and course. Confirms what data still exists and what's been cleared.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const url = process.env.MONGO_URI_OVERRIDE || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('vibe');

  const userObjectId = new ObjectId('6a46ec683f01733f189df8a3');
  const userString = '6a46ec683f01733f189df8a3';

  console.log('=== Counts of related collections ===');
  for (const colName of [
    'enrollments',
    'enrollment',
    'course_registrations',
    'progress',
    'progresses',
    'companions',
    'watchTime',
    'user_activity_events',
    'user_quiz_metrics',
    'quiz_attempts',
    'quiz_submission_results',
  ]) {
    let c = '?';
    try {
      c = await db.collection(colName).countDocuments();
    } catch (e) {
      c = `(err: ${e.message.slice(0, 30)})`;
    }
    console.log(`  ${colName.padEnd(35)} ${c}`);
  }
  console.log('');

  console.log('=== Documents by test learner userId ===');
  for (const colName of [
    'enrollments',
    'enrollment',
    'course_registrations',
    'progress',
    'progresses',
    'companions',
  ]) {
    try {
      const docs = await db.collection(colName).find({ userId: userObjectId }).toArray();
      console.log(`  ${colName}.find({userId: ObjectId(test)}) = ${docs.length}`);
      docs.slice(0, 3).forEach((d, i) => {
        const summary = {};
        for (const k of Object.keys(d)) {
          const v = d[k];
          if (v && typeof v === 'object' && v.toString) {
            summary[k] = v.constructor?.name === 'ObjectId' ? v.toString() : `<${v.constructor?.name}>`;
          } else {
            summary[k] = JSON.stringify(v)?.slice(0, 60);
          }
        }
        console.log(`    [${i}]`, summary);
      });
    } catch (e) {
      console.log(`  ${colName}: ERR ${e.message}`);
    }
  }
  console.log('');

  console.log('=== Documents by string userId ===');
  for (const colName of ['enrollments', 'enrollment', 'course_registrations', 'companions']) {
    try {
      const docs = await db.collection(colName).find({ userId: userString }).toArray();
      console.log(`  ${colName}.find({userId: string}) = ${docs.length}`);
    } catch (e) {
      console.log(`  ${colName}: ERR ${e.message}`);
    }
  }
  console.log('');

  console.log('=== First few docs in enrollments collection ===');
  try {
    const docs = await db.collection('enrollments').find({}).limit(10).toArray();
    if (docs.length === 0) {
      console.log('  EMPTY');
    } else {
      docs.forEach((d, i) => {
        console.log(`  [${i}] _id: ${d._id?.toString()}, userId: ${d.userId?.toString?.() || d.userId}, role: ${d.role}, status: ${d.status}, courseId: ${d.courseId?.toString?.() || d.courseId}`);
      });
    }
  } catch (e) {
    console.log('  ERR:', e.message);
  }

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});