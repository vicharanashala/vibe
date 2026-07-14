// diag-find-course.cjs — find the course after seed
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  // List all collections
  const cols = await db.listCollections().toArray();
  console.log('Collections: ' + cols.map(c => c.name).sort().join(', '));

  // List all courses
  console.log('\n--- newCourse ---');
  const courses = await db.collection('newCourse').find({}).toArray();
  for (const c of courses) {
    console.log('  ' + c._id + ' name="' + (c.name || '?') + '"');
  }
  console.log('Total newCourse: ' + courses.length);

  console.log('\n--- newCourseVersion ---');
  const versions = await db.collection('newCourseVersion').find({}).toArray();
  for (const v of versions) {
    console.log('  ' + v._id + ' courseId=' + v.courseId + ' version=' + v.version + ' status=' + v.versionStatus);
  }
  console.log('Total newCourseVersion: ' + versions.length);

  console.log('\n--- newSection ---');
  const sections = await db.collection('newSection').find({}).toArray();
  for (const s of sections) {
    console.log('  ' + s._id + ' name="' + (s.name || s.sectionName || '?') + '" items=' + (Array.isArray(s.items) ? 'array(' + s.items.length + ')' : typeof s.items));
  }
  console.log('Total newSection: ' + sections.length);

  console.log('\n--- itemsGroup ---');
  const groups = await db.collection('itemsGroup').find({}).toArray();
  for (const g of groups) {
    console.log('  ' + g._id + ' sectionId=' + g.sectionId + ' items=' + (g.items?.length || 0));
  }
  console.log('Total itemsGroup: ' + groups.length);

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });