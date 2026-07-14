// bump-companion-progress.cjs
// Directly sets percentCompleted on the enrollment document so the
// CompanionService re-computes stage+mood live on the next /companion/me poll.
//
// Real stage thresholds (CompanionService._computeStage):
//   p <  17  → stage 0  (Baby 🥚)
//   p >= 17  → stage 1  (Toddler 🐣)
//   p >= 33  → stage 2  (Child 🌱)
//   p >= 50  → stage 3  (Teen 🌿)
//   p >= 67  → stage 4  (Young Adult 🌸)
//   p >= 83  → stage 5  (Adult ⭐)
//
// Usage (PowerShell):
//   $env:TARGET_PCT = 50; node scripts/bump-companion-progress.cjs
//
// Default TARGET_PCT = 100

const { MongoClient, ObjectId } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/?directConnection=true';
const DB_NAME = 'vibe';

// Target: sahasra2069@gmail.com (6a4b9f85cc68bde40897fc16)
// We write to the 'enrollments' collection (plural) — the one
// CompanionService._getRealProgress actually queries.
const USER_ID = '6a4b9f85cc68bde40897fc16';
const USER_OBJ = new ObjectId(USER_ID);

const TARGET_PCT = parseInt(process.env.TARGET_PCT || '100', 10);

const STAGE_THRESHOLDS = [
  { min: 83, stage: 5, label: 'Adult ⭐' },
  { min: 67, stage: 4, label: 'Young Adult 🌸' },
  { min: 50, stage: 3, label: 'Teen 🌿' },
  { min: 33, stage: 2, label: 'Child 🌱' },
  { min: 17, stage: 1, label: 'Toddler 🐣' },
  { min: 0,  stage: 0, label: 'Baby 🥚' },
];

function computeStage(pct) {
  const s = STAGE_THRESHOLDS.find(t => pct >= t.min);
  return s ? s.label : 'Baby 🥚';
}

(async () => {
  const client = new MongoClient(MONGO_URI, { directConnection: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const coll = db.collection('enrollments');

    console.log('=== Connected to MongoDB ===');
    console.log(`Target userId : ${USER_ID}`);
    console.log(`Setting percentCompleted → ${TARGET_PCT}%`);
    console.log(`Expected stage: ${computeStage(TARGET_PCT)}`);
    console.log('');

    // Upsert: update if exists, insert a minimal enrollment if none exists.
    // This ensures the test always has something to bump.
    const existing = await coll.findOne({ userId: USER_OBJ, role: 'STUDENT' });

    if (existing) {
      console.log(`Found enrollment _id: ${existing._id} (percentCompleted was: ${existing.percentCompleted})`);
      await coll.updateOne(
        { _id: existing._id },
        { $set: { percentCompleted: TARGET_PCT, updatedAt: new Date() } },
      );
      console.log(`Updated percentCompleted → ${TARGET_PCT}%`);
    } else {
      // Insert a minimal enrollment so we have something to test with
      const doc = {
        userId: USER_OBJ,
        courseId: new ObjectId('6a53311b5b3a0f2ab44dc807'), // test course
        courseVersionId: new ObjectId('6a53311b5b3a0f2ab44dc808'),
        role: 'STUDENT',
        status: 'ACTIVE',
        percentCompleted: TARGET_PCT,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        enrollmentDate: new Date(),
      };
      const result = await coll.insertOne(doc);
      console.log(`No existing enrollment — inserted new _id: ${result.insertedId}`);
      console.log(`percentCompleted → ${TARGET_PCT}%`);
    }

    console.log('\n✅ Done. Hard-refresh browser (Ctrl+F5) — companion should be at:');
    console.log(`   ${computeStage(TARGET_PCT)} (${TARGET_PCT}%)`);

  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await client.close();
  }
})();