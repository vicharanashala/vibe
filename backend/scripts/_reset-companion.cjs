const {MongoClient, ObjectId} = require('mongodb');

const PANDU_ID = '6a4b8c7e1e6b7a91c33fb27c';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');
  const uid = new ObjectId(PANDU_ID);

  const companions = db.collection('companions');

  // Wipe any existing companion — forces a fresh pick on next /companion/me call
  const r = await companions.deleteOne({userId: uid});
  console.log('Companion deleted:', r.deletedCount > 0 ? 'yes' : 'no companion document existed');

  // Also wipe watchTime and quiz_submission_results for this user
  // so _daysSinceLastActivity returns 0 cleanly on next call
  const wt = await db.collection('watchTime').deleteMany({userId: uid});
  const qs = await db.collection('quiz_submission_results').deleteMany({userId: uid});
  console.log(`WatchTime records deleted: ${wt.deletedCount}`);
  console.log(`Quiz submission results deleted: ${qs.deletedCount}`);

  console.log('\nCompanion reset complete.');
  console.log('Next /api/companion/me call will require the student to re-pick an animal.');
  console.log('Expected mood after re-pick: neutral (Stage 0, no enrollments, no activity)');

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });