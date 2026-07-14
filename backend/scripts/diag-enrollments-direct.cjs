// diag-enrollments-direct.cjs — fetch the user's enrollments via the DB the same way the API would
// This simulates exactly what the endpoint /users/enrollments?role=STUDENT&tab=active returns.

const { MongoClient, ObjectId } = require('mongodb');
const http = require('http');

const LEARNER_ID = '6a46ec683f01733f189df8a3';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5173';  // Vite dev proxies /api → backend
// Or directly: process.env.BACKEND_URL || 'http://localhost:4000';

(async () => {
  // First, the DB-direct test
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  console.log('=== DB-direct aggregation (matches what the API does) ===');
  const userObjectId = new ObjectId(LEARNER_ID);

  // /users/enrollments uses getEnrollments → getBasicEnrollments → gets ALL enrollments for user (no role filter at this stage)
  // then the STUDENT branch filters to active versions and version.modules[].sections[].itemsGroup.items
  const allEnr = await db.collection('enrollment').aggregate([
    {
      $match: {
        userId: { $in: [userObjectId, LEARNER_ID] },
        isDeleted: { $ne: true },
        status: 'ACTIVE',
      },
    },
  ]).toArray();

  console.log('All ACTIVE enrollments: ' + allEnr.length);
  for (const e of allEnr) {
    console.log('  _id=' + e._id);
    console.log('    role=' + e.role + ' status=' + e.status);
    console.log('    userId=' + e.userId + ' (typeof ' + typeof e.userId + ')');
    console.log('    courseId=' + e.courseId);
    console.log('    courseVersionId=' + e.courseVersionId);
    console.log('    percentCompleted=' + e.percentCompleted);
  }

  // Now check the matching version has modules.sections.itemsGroupId all valid
  if (allEnr.length) {
    const e = allEnr[0];
    const versionId = typeof e.courseVersionId === 'string' ? new ObjectId(e.courseVersionId) : e.courseVersionId;
    const version = await db.collection('newCourseVersion').findOne({ _id: versionId });
    console.log('\n=== Version ===');
    console.log('  _id=' + version._id);
    console.log('  versionStatus=' + version.versionStatus);
    console.log('  modules: ' + (Array.isArray(version.modules) ? version.modules.length : 'not array'));
    if (Array.isArray(version.modules)) {
      for (const m of version.modules) {
        console.log('    module ' + m.moduleId + ' — sections: ' + (Array.isArray(m.sections) ? m.sections.length : 'NA'));
      }
    }
  }

  // Now actually hit the API
  console.log('\n=== Direct API call ===');
  console.log('Mocking auth token... if backend requires auth, this will 401. Skipping direct API and using service instead.');

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });