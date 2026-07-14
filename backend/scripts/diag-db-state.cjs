const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  const collections = ['enrollment', 'videos', 'quizzes', 'newSection', 'itemsGroup', 'newCourse', 'newCourseVersion', 'questions', 'questionBanks', 'users'];
  const counts = {};
  for (const name of collections) {
    try { counts[name] = await db.collection(name).countDocuments({}); }
    catch (e) { counts[name] = 'ERR: ' + e.message; }
  }
  console.log('=== COUNTS ===');
  console.log(JSON.stringify(counts, null, 2));

  console.log('\n=== ENROLLMENT for course 6a4f774273de56bebbabd662 ===');
  const enr = await db.collection('enrollment').find({
    courseId: new ObjectId('6a4f774273de56bebbabd662'),
    isDeleted: { $ne: true },
  }).toArray();
  console.log('count:', enr.length);
  enr.forEach(e => console.log('  userId=' + e.userId + ' pct=' + e.percentCompleted + ' status=' + e.status + ' role=' + e.role));

  console.log('\n=== VIDEOS / QUIZZES ===');
  console.log('videos[668]:', await db.collection('videos').countDocuments({ _id: new ObjectId('6a4f774273de56bebbabd668') }));
  console.log('quizzes[669]:', await db.collection('quizzes').countDocuments({ _id: new ObjectId('6a4f774273de56bebbabd669') }));

  console.log('\n=== SECTIONS for course version 663 ===');
  const sec = await db.collection('newSection').find({ courseVersionId: new ObjectId('6a4f774273de56bebbabd663') }).toArray();
  console.log('section count:', sec.length);

  console.log('\n=== ITEM GROUPS for course version 663 (or anywhere) ===');
  const ig = await db.collection('itemsGroup').find({}).limit(5).toArray();
  console.log('itemsGroup sample (first 5):', ig.length, 'docs');
  ig.forEach(g => console.log('  _id=' + g._id + ' sectionId=' + g.sectionId + ' items=' + (g.items?.length ?? 'n/a')));

  console.log('\n=== QUESTION BANK for quiz 669 ===');
  console.log('questionBanks[670]:', await db.collection('questionBanks').countDocuments({ _id: new ObjectId('6a4f774273de56bebbabd670') }));
  console.log('questions[671]:', await db.collection('questions').countDocuments({ _id: new ObjectId('6a4f774273de56bebbabd671') }));

  console.log('\n=== ALL USERS ===');
  const us = await db.collection('users').find({}, { projection: { _id: 1, email: 1, firstName: 1 } }).toArray();
  console.log('user count:', us.length);
  us.forEach(u => console.log('  _id=' + u._id + ' email=' + u.email + ' firstName=' + u.firstName));

  await c.close();
})().catch(e => { console.error(e); process.exit(1); });