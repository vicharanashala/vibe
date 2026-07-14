// _reset-companion-test.cjs
// Cleans up test data and resets companion back to Stage 0 / neutral.
// Run this AFTER testing to restore the companion to normal state.

const {MongoClient, ObjectId} = require('mongodb');
const USER_ID = '6a4b9f85cc68bde40897fc16';
const USER_OBJ = new ObjectId(USER_ID);

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const e = await db.collection('enrollments').deleteMany({userId: USER_OBJ});
  const w = await db.collection('watchTime').deleteMany({userId: USER_OBJ});
  const q = await db.collection('quiz_submission_results').deleteMany({userId: USER_OBJ});

  console.log(`Cleaned up:`);
  console.log(`  enrollments  deleted: ${e.deletedCount}`);
  console.log(`  watchTime    deleted: ${w.deletedCount}`);
  console.log(`  quiz_results deleted: ${q.deletedCount}`);
  console.log(`\nCompanion is back to Stage 0 / neutral (0 enrollments, 0 watch time)`);
  console.log(`Hard-refresh browser (Ctrl+F5) to confirm.`);

  await client.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });