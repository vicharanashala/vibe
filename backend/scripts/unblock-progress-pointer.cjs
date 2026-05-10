/**
 * One-off script: advance a learner's progress.currentItem to a target item
 * when a slow /stop left the pointer behind.
 *
 * Usage:
 *   MONGO_URL='...' DB_NAME=vibe \
 *   USER_ID=<userId> COURSE_ID=<courseId> VERSION_ID=<versionId> \
 *   MODULE_ID=<moduleId> SECTION_ID=<sectionId> ITEM_ID=<itemId> \
 *   [COHORT_ID=<cohortId>] \
 *   node scripts/unblock-progress-pointer.cjs
 */
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const url = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || 'vibe';
  const required = ['USER_ID', 'COURSE_ID', 'VERSION_ID', 'MODULE_ID', 'SECTION_ID', 'ITEM_ID'];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`Missing env ${k}`);
  }
  if (!url) throw new Error('Missing MONGO_URL');

  const client = new MongoClient(url);
  await client.connect();
  try {
    const db = client.db(dbName);
    const filter = {
      userId: new ObjectId(process.env.USER_ID),
      courseId: new ObjectId(process.env.COURSE_ID),
      courseVersionId: new ObjectId(process.env.VERSION_ID),
    };
    if (process.env.COHORT_ID) {
      filter.cohortId = new ObjectId(process.env.COHORT_ID);
    }
    const update = {
      $set: {
        currentModule: new ObjectId(process.env.MODULE_ID),
        currentSection: new ObjectId(process.env.SECTION_ID),
        currentItem: new ObjectId(process.env.ITEM_ID),
        completed: false,
        updatedAt: new Date(),
      },
    };
    const before = await db.collection('progress').findOne(filter);
    console.log('Before:', before);
    const res = await db.collection('progress').updateOne(filter, update);
    console.log('Matched:', res.matchedCount, 'Modified:', res.modifiedCount);
    const after = await db.collection('progress').findOne(filter);
    console.log('After:', after);
  } finally {
    await client.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
