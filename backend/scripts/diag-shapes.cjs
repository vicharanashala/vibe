// diag-typed-items-shape.cjs — see how typed videos/quizzes docs are shaped
// after a fresh seed+fixup cycle, to understand the "items is not iterable" bug.
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  console.log('--- Counting collections ---');
  for (const name of ['newCourse', 'newCourseVersion', 'newSection', 'itemsGroup', 'videos', 'quizzes', 'users']) {
    const n = await db.collection(name).countDocuments();
    console.log('  ' + name + ': ' + n);
  }

  // Check a sample itemsGroup if it exists
  const igs = await db.collection('itemsGroup').find({}).limit(2).toArray();
  if (igs.length) {
    console.log('\n--- Sample itemsGroup raw shape ---');
    console.log(JSON.stringify(igs[0], null, 2));
  }

  await c.close();
})().catch(e => { console.error(e); process.exit(1); });