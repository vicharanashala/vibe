// scripts/diag-cohorts-2026-07-09.cjs
// Look for any cohorts in the system, see if our test course has a cohortId,
// and check if EnrollmentRepository stores cohortId as null vs missing.

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // List all collections matching cohort
  const colls = await db.listCollections().toArray();
  const cohortColls = colls.filter(c => /cohort/i.test(c.name));
  console.log('Cohort-related collections:', cohortColls.map(c => c.name));

  // Look at all possible cohort collection names
  for (const cname of ['cohort', 'cohorts', 'newCohort', 'newcohort']) {
    try {
      const cnt = await db.collection(cname).countDocuments();
      if (cnt > 0) {
        const docs = await db.collection(cname).find({}).limit(5).toArray();
        console.log(`\n=== ${cname} (${cnt} docs) ===`);
        for (const d of docs) {
          console.log(`  _id=${d._id} ${JSON.stringify(d).slice(0, 200)}`);
        }
      }
    } catch (e) { /* skip */ }
  }

  // Check our test course's cohort settings
  const courseSettings = await db.collection('courseSettings').findOne({
    courseId: new ObjectId('6a4f774273de56bebbabd662'),
  });
  console.log('\n=== courseSettings for our test course ===');
  console.log(JSON.stringify(courseSettings, null, 2));

  // Check what cohortId appears anywhere in our test data
  console.log('\n=== Sample of cohorts on other courses ===');
  const otherSettings = await db.collection('courseSettings').find({}).limit(3).toArray();
  for (const s of otherSettings) {
    console.log(`courseId=${s.courseId} settings: ${JSON.stringify(s.settings).slice(0, 300)}`);
  }

  await client.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});