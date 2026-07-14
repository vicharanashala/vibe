// fix-id-types.cjs — convert string IDs in enrollment + course_registrations to ObjectIds
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  console.log('=== Fixing enrollment rows ===');
  const enrCol = db.collection('enrollment');
  const enrollments = await enrCol.find({}).toArray();
  let ePatched = 0;
  for (const e of enrollments) {
    let needsUpdate = false;
    const update = {};
    if (typeof e.userId === 'string' && ObjectId.isValid(e.userId)) {
      update.userId = new ObjectId(e.userId);
      needsUpdate = true;
    }
    if (typeof e.courseId === 'string' && ObjectId.isValid(e.courseId)) {
      update.courseId = new ObjectId(e.courseId);
      needsUpdate = true;
    }
    if (typeof e.courseVersionId === 'string' && ObjectId.isValid(e.courseVersionId)) {
      update.courseVersionId = new ObjectId(e.courseVersionId);
      needsUpdate = true;
    }
    if (needsUpdate) {
      await enrCol.updateOne({ _id: e._id }, { $set: update });
      console.log('  Patched enrollment ' + e._id);
      ePatched++;
    }
  }
  console.log('Total enrollments patched: ' + ePatched);

  console.log('\n=== Fixing course_registrations rows ===');
  const regCol = db.collection('course_registrations');
  const regs = await regCol.find({}).toArray();
  let rPatched = 0;
  for (const r of regs) {
    let needsUpdate = false;
    const update = {};
    if (typeof r.studentId === 'string' && ObjectId.isValid(r.studentId)) {
      update.studentId = new ObjectId(r.studentId);
      needsUpdate = true;
    }
    if (typeof r.userId === 'string' && ObjectId.isValid(r.userId)) {
      update.userId = new ObjectId(r.userId);
      needsUpdate = true;
    }
    if (typeof r.courseId === 'string' && ObjectId.isValid(r.courseId)) {
      update.courseId = new ObjectId(r.courseId);
      needsUpdate = true;
    }
    if (typeof r.courseVersionId === 'string' && ObjectId.isValid(r.courseVersionId)) {
      update.courseVersionId = new ObjectId(r.courseVersionId);
      needsUpdate = true;
    }
    if (needsUpdate) {
      await regCol.updateOne({ _id: r._id }, { $set: update });
      console.log('  Patched registration ' + r._id);
      rPatched++;
    }
  }
  console.log('Total registrations patched: ' + rPatched);

  // Also fix companion userId
  console.log('\n=== Fixing companion userId ===');
  const compCol = db.collection('companions');
  const comps = await compCol.find({}).toArray();
  let cPatched = 0;
  for (const x of comps) {
    if (typeof x.userId === 'string' && ObjectId.isValid(x.userId)) {
      await compCol.updateOne({ _id: x._id }, { $set: { userId: new ObjectId(x.userId) } });
      console.log('  Patched companion ' + x._id);
      cPatched++;
    }
  }
  console.log('Total companions patched: ' + cPatched);

  // Verify
  console.log('\n=== Verification ===');
  const verify = await enrCol.findOne({ userId: new ObjectId('6a46ec683f01733f189df8a3') });
  console.log('Enrollment queryable by ObjectId: ' + (verify ? 'YES' : 'NO'));
  const verifyReg = await regCol.findOne({ $or: [{ studentId: new ObjectId('6a46ec683f01733f189df8a3') }, { userId: new ObjectId('6a46ec683f01733f189df8a3') }] });
  console.log('Registration queryable by ObjectId: ' + (verifyReg ? 'YES' : 'NO'));
  const verifyComp = await compCol.findOne({ userId: new ObjectId('6a46ec683f01733f189df8a3') });
  console.log('Companion queryable by ObjectId: ' + (verifyComp ? 'YES' : 'NO'));

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });