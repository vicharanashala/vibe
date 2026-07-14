// diag-list-courses.cjs — list all courses, versions, modules, sections, itemsGroups
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  const courses = await db.collection('newCourse').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('=== COURSES ===');
  for (const co of courses) {
    console.log('  _id=' + co._id + '  name=' + JSON.stringify(co.name) + '  isDeleted=' + co.isDeleted + '  status=' + co.status);
  }

  const versions = await db.collection('newCourseVersion').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('\n=== VERSIONS ===');
  for (const v of versions) {
    console.log('  _id=' + v._id + '  courseId=' + v.courseId + '  modules.length=' + (v.modules || []).length);
  }

  const sections = await db.collection('newSection').find({}).toArray();
  console.log('\n=== SECTIONS (count=' + sections.length + ') ===');
  for (const s of sections.slice(0, 10)) {
    console.log('  _id=' + s._id + '  itemsGroupId=' + s.itemsGroupId + '  isDeleted=' + s.isDeleted);
  }

  const igs = await db.collection('itemsGroup').find({}).toArray();
  console.log('\n=== ITEMSGROUPS (count=' + igs.length + ') ===');
  for (const g of igs.slice(0, 10)) {
    console.log('  _id=' + g._id + '  sectionId=' + g.sectionId + '  items.length=' + (g.items || []).length);
    for (const it of (g.items || [])) {
      console.log('    item._id=' + it._id + '  type=' + it.type + '  order=' + it.order + '  name=' + JSON.stringify(it.name));
    }
  }

  const videos = await db.collection('videos').find({}).toArray();
  console.log('\n=== VIDEOS (count=' + videos.length + ') ===');
  for (const v of videos) {
    console.log('  _id=' + v._id + '  itemId=' + v.itemId + '  name=' + JSON.stringify(v.name));
  }

  const quizzes = await db.collection('quizzes').find({}).toArray();
  console.log('\n=== QUIZZES (count=' + quizzes.length + ') ===');
  for (const q of quizzes) {
    console.log('  _id=' + q._id + '  itemId=' + q.itemId + '  name=' + JSON.stringify(q.name));
  }

  const users = await db.collection('users').find({}).toArray();
  console.log('\n=== USERS (count=' + users.length + ') ===');
  for (const u of users) {
    console.log('  _id=' + u._id + '  email=' + u.email);
  }

  await c.close();
})().catch(e => { console.error(e); process.exit(1); });