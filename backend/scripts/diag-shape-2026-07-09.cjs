// scripts/diag-shape.cjs
// Diagnostic: dump the current shape of every collection relevant to course registration
// so we can find one that's actually working and compare.

const {MongoClient} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' COLLECTIONS RELEVANT TO COURSE REGISTRATION');
  console.log('═══════════════════════════════════════════════════════════════');
  const cols = await db.listCollections().toArray();
  const relevant = cols.filter(c =>
    ['newCourse', 'newCourseVersion', 'newSection', 'newModule',
     'itemsGroup', 'items', 'enrollment', 'quiz_submission_results',
     'courseSettings', 'cohorts', 'quizzes', 'registration'].some(s => c.name.includes(s))
  );
  console.log(relevant.map(c => `  ${c.name}`).join('\n'));

  // 1) one successful enrollment (to see what a working version looks like)
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' 1) ANY ENROLLMENT (sample)');
  console.log('═══════════════════════════════════════════════════════════════');
  const sampleEnr = await db.collection('enrollment').findOne({});
  console.log(JSON.stringify(sampleEnr, null, 2));

  // 2) any itemsGroup
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' 2) ANY ITEMS GROUP (sample)');
  console.log('═══════════════════════════════════════════════════════════════');
  const sampleIG = await db.collection('itemsGroup').findOne({});
  console.log(JSON.stringify(sampleIG, null, 2));
  if (sampleIG) {
    console.log(`\nitemsGroup count: ${await db.collection('itemsGroup').countDocuments({})}`);

    // Look for IG whose items have actual item docs
    const allGroups = await db.collection('itemsGroup').find({}).limit(20).toArray();
    let withItems = 0;
    for (const g of allGroups) {
      const refs = g.items || [];
      if (refs.length > 0) {
        const first = refs[0];
        const itemId = typeof first.itemId === 'string' ? first.itemId : first.itemId?.toString();
        const present = await db.collection('items').findOne({_id: (() => {
          try { return new (require('mongodb').ObjectId)(itemId); } catch { return null; }
        })()});
        if (present) withItems++;
      }
    }
    console.log(`itemsGroups with at least one real item: ${withItems} (of ${allGroups.length} sampled)`);
  }

  // 3) any course version with structure (find one that has any enrollments)
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' 3) COURSES WITH ENROLLMENTS');
  console.log('═══════════════════════════════════════════════════════════════');
  const enrolledCourses = await db.collection('enrollment').distinct('courseId');
  console.log(`Distinct courseIds in enrollment: ${JSON.stringify(enrolledCourses)}`);
  for (const cid of enrolledCourses) {
    const versions = await db.collection('newCourseVersion').find({courseId: cid}).toArray();
    const itemsCount = await db.collection('items').countDocuments({});
    console.log(`  course ${cid}: versions=${versions.map(v => v._id).join(',')} (all items in DB: ${itemsCount})`);
  }

  // 4) any section (we know it's 0, but checking for related collections)
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' 4) ANY SECTION OR MODULE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`newSection count: ${await db.collection('newSection').countDocuments({})}`);
  console.log(`newModule count: ${await db.collection('newModule').countDocuments({})}`);
  if (await db.collection('newModule').countDocuments({}) > 0) {
    const m = await db.collection('newModule').findOne({});
    console.log(JSON.stringify(m, null, 2));
  }

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });