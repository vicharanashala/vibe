const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  const collections = ['enrollment', 'videos', 'videos_v2', 'videos_v3', 'items', 'quizzes', 'questions', 'questionBanks', 'newSection', 'itemsGroup', 'newCourse', 'newCourseVersion', 'courseSettings', 'users'];
  const counts = {};
  for (const name of collections) {
    try { counts[name] = await db.collection(name).countDocuments({}); }
    catch (e) { counts[name] = 'ERR: ' + e.message; }
  }
  console.log('=== COUNTS ===');
  console.log(JSON.stringify(counts, null, 2));

  // Show the new seed's items
  console.log('\n=== ITEMS in items collection ===');
  const items = await db.collection('items').find({}).toArray();
  items.forEach(i => console.log('  _id=' + i._id + ' type=' + i.type + ' name=' + i.name));

  console.log('\n=== ITEMS GROUPS ===');
  const igs = await db.collection('itemsGroup').find({}).toArray();
  igs.forEach(g => console.log('  _id=' + g._id + ' sectionId=' + g.sectionId + ' items=' + JSON.stringify(g.items)));

  console.log('\n=== NEW COURSE / VERSIONS ===');
  const cs = await db.collection('newCourse').find({}).toArray();
  cs.forEach(c => console.log('  newCourse _id=' + c._id + ' name=' + c.name));
  const vs = await db.collection('newCourseVersion').find({}).toArray();
  vs.forEach(v => console.log('  newCourseVersion _id=' + v._id + ' courseId=' + v.courseId + ' versionStatus=' + v.versionStatus));

  console.log('\n=== SECTIONS ===');
  const se = await db.collection('newSection').find({}).toArray();
  se.forEach(s => console.log('  newSection _id=' + s._id + ' courseVersionId=' + s.courseVersionId));

  console.log('\n=== COURSE SETTINGS ===');
  const cs2 = await db.collection('courseSettings').find({}).toArray();
  cs2.forEach(s => console.log('  courseSettings courseId=' + s.courseId + ' courseVersionId=' + s.courseVersionId + ' isPublic=' + s.settings?.isPublic));

  console.log('\n=== ITEMS in "videos" collection (typed) ===');
  const typedVids = await db.collection('videos').find({}).toArray();
  console.log('typed videos count:', typedVids.length);
  typedVids.forEach(v => console.log('  _id=' + v._id + ' name=' + v.name + ' URL=' + v.URL));

  console.log('\n=== ITEMS in "quizzes" collection (typed) ===');
  const typedQz = await db.collection('quizzes').find({}).toArray();
  console.log('typed quizzes count:', typedQz.length);
  typedQz.forEach(q => console.log('  _id=' + q._id + ' itemId=' + q.itemId + ' questionBankRefs=' + JSON.stringify(q.details?.questionBankRefs)));

  await c.close();
})().catch(e => { console.error(e); process.exit(1); });