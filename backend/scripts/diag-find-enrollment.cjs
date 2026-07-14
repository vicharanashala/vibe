/**
 * diag-find-enrollment.cjs
 *
 * Find ALL enrollments in the DB and print their full structure.
 * This will show us the actual userId field/value of the test enrollment.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const url = process.env.MONGO_URI_OVERRIDE || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('vibe');

  // ALL enrollments
  console.log('=== ALL enrollments ===');
  const all = await db.collection('enrollments').find({}).toArray();
  console.log('count:', all.length);
  for (const e of all) {
    const fields = {};
    for (const k of Object.keys(e)) {
      const v = e[k];
      if (v && typeof v === 'object' && v.toString) {
        fields[k] = `${typeof v} (${v.constructor?.name}) = ${v.toString()}`;
      } else {
        fields[k] = JSON.stringify(v)?.slice(0, 100);
      }
    }
    console.log(`  _id: ${e._id?.toString()}`);
    console.log(`    userId:`, fields.userId);
    console.log(`    userIdKeys:`, Object.keys(e).filter(k => k.toLowerCase().includes('user')));
    console.log(`    courseId:`, fields.courseId);
    console.log(`    courseVersionId:`, fields.courseVersionId);
    console.log(`    role:`, fields.role, '| status:', fields.status, '| isDeleted:', fields.isDeleted);
    console.log(`    percentCompleted:`, fields.percentCompleted);
    console.log('');
  }

  // Now query for the test learner's user doc
  console.log('=== All users (just emails + _ids) ===');
  const users = await db.collection('users').find({}).project({ _id: 1, email: 1, firebaseUid: 1 }).toArray();
  users.forEach(u => {
    console.log(`  ${u._id?.toString()} | ${u.email} | fb: ${u.firebaseUid}`);
  });

  // Now search for the enrollment by ID directly (since we know the _id from earlier)
  console.log('');
  console.log('=== Direct lookup of enrollment by _id ===');
  const knownId = '6a50cd31b8ec5d23f45acc47';
  try {
    const doc = await db.collection('enrollments').findOne({ _id: new ObjectId(knownId) });
    if (doc) {
      console.log('FOUND:', JSON.stringify(doc, (k, v) => v && typeof v === 'object' && v.constructor?.name === 'ObjectId' ? v.toString() : v, 2));
    } else {
      console.log('NOT FOUND by ObjectId _id - trying string _id');
      const doc2 = await db.collection('enrollments').findOne({ _id: knownId });
      if (doc2) {
        console.log('FOUND by string:', JSON.stringify(doc2, (k, v) => v && typeof v === 'object' && v.constructor?.name === 'ObjectId' ? v.toString() : v, 2));
      } else {
        console.log('NOT FOUND at all');
      }
    }
  } catch (e) {
    console.log('ERR:', e.message);
  }

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});