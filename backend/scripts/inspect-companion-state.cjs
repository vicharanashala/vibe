// inspect-companion-state.cjs
// Read-only diagnostic: dumps the current state of enrollment + companion for the test learner.
// Use BEFORE bump-companion-progress.cjs to confirm current state.

const { MongoClient, ObjectId } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/?directConnection=true';
const DB_NAME = 'vibe';

const USER_ID = '6a4b9f85cc68bde40897fc16'; // sahasra2069@gmail.com
const ENROLLMENT_ID = '6a50fe0e9850fcfc6ddf49a7';
const COMPANION_ID = '6a4bdc7940f5a3ec95b400ab';

(async () => {
  const client = new MongoClient(MONGO_URI, { directConnection: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log('=== Inspecting test learner state ===\n');

    const user = await db.collection('users').findOne({ _id: new ObjectId(USER_ID) });
    console.log(`User: ${user?.name || user?.email || USER_ID}`);
    console.log(`Email: ${user?.email}`);

    const enr = await db.collection('enrollment').findOne({ _id: new ObjectId(ENROLLMENT_ID) });
    console.log(`\n--- Enrollment (${ENROLLMENT_ID}) ---`);
    if (enr) {
      console.log(`  percentCompleted: ${enr.percentCompleted}`);
      console.log(`  status: ${enr.status}`);
      console.log(`  totalItemsCount: ${enr.totalItemsCount}`);
      console.log(`  completedItemsCount: ${enr.completedItemsCount}`);
      console.log(`  isDeleted: ${enr.isDeleted}`);
    } else {
      console.log('  NOT FOUND');
    }

    const comp = await db.collection('companions').findOne({ _id: new ObjectId(COMPANION_ID) });
    console.log(`\n--- Companion (${COMPANION_ID}) ---`);
    if (comp) {
      console.log(`  animal: ${comp.animal}`);
      console.log(`  userId: ${comp.userId}`);
      console.log(`  panda: ${JSON.stringify(comp.panda || {}, null, 2)}`);
    } else {
      console.log('  NOT FOUND');
    }
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    await client.close();
  }
})();