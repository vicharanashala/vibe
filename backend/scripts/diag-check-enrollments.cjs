// diag-check-enrollments.cjs — diagnose why frontend doesn't show the enrolled course
const { MongoClient } = require('mongodb');

const LEARNER_ID = '6a46ec683f01733f189df8a3';

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  console.log('=== All enrollment rows for learner ' + LEARNER_ID + ' ===');
  const enrCol = db.collection('enrollment');
  const enrollments = await enrCol.find({ userId: new (require('mongodb').ObjectId)(LEARNER_ID) }).toArray();
  console.log('Count: ' + enrollments.length);
  for (const e of enrollments) {
    console.log('  ' + JSON.stringify(e, null, 2));
  }

  console.log('\n=== All course_registrations rows for learner ===');
  const regCol = db.collection('course_registrations');
  const regs = await regCol.find({ $or: [{ userId: new (require('mongodb').ObjectId)(LEARNER_ID) }, { studentId: new (require('mongodb').ObjectId)(LEARNER_ID) }] }).toArray();
  console.log('Count: ' + regs.length);
  for (const r of regs) {
    console.log('  ' + JSON.stringify(r, null, 2));
  }

  console.log('\n=== Trying as string userId ===');
  const enrByStr = await enrCol.find({ userId: LEARNER_ID }).toArray();
  console.log('Count (string match): ' + enrByStr.length);
  for (const e of enrByStr) {
    console.log('  ' + JSON.stringify(e, null, 2));
  }

  // Check the version doc
  console.log('\n=== Version ===');
  const v = await db.collection('newCourseVersion').findOne({ _id: new (require('mongodb').ObjectId)('6a50cb21b59da603242f22ac') });
  console.log(JSON.stringify(v, null, 2));

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });