// _test-stage.cjs
// Sets percentCompleted on the enrollment to simulate progress.
// Usage: node backend/scripts/_test-stage.cjs 50
// Stage guide: 5%=Baby🥚, 20%=Toddler🐣, 40%=Child🌱, 55%=Teen🌿, 70%=YoungAdult🌸, 85%=Adult⭐, 100%=Adult⭐+celebrating

const {MongoClient, ObjectId} = require('mongodb');
const TARGET_PCT = parseInt(process.argv[2] || '50', 10);
const USER_ID = '6a4b9f85cc68bde40897fc16';
const USER_OBJ = new ObjectId(USER_ID);

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');
  const coll = db.collection('enrollments');

  const existing = await coll.findOne({userId: USER_OBJ, role: 'STUDENT'});
  if (existing) {
    await coll.updateOne({_id: existing._id}, {'$set': {percentCompleted: TARGET_PCT}});
    console.log(`Updated percentCompleted → ${TARGET_PCT}% (enrollment _id: ${existing._id})`);
  } else {
    const doc = {
      userId: USER_OBJ,
      courseId: new ObjectId('000000000000000000000001'),
      courseVersionId: new ObjectId('000000000000000000000001'),
      role: 'STUDENT',
      status: 'ACTIVE',
      percentCompleted: TARGET_PCT,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      enrollmentDate: new Date(),
    };
    const r = await coll.insertOne(doc);
    console.log(`Inserted enrollment at ${TARGET_PCT}% (_id: ${r.insertedId})`);
  }

  console.log(`\nHard-refresh browser (Ctrl+F5) — companion should show stage for ${TARGET_PCT}%`);
  await client.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });