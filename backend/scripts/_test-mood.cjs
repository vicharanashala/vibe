// _test-mood.cjs
// Sets idleDays by inserting a watchTime record with an old endTime.
// Mood is derived from (progress, idleDays).
// Usage: node backend/scripts/_test-mood.cjs 3 20
//   arg1 = idleDays (how many days ago lesson was completed)
//   arg2 = progress (percentCompleted, default 20)
//
// Mood results:
//   idle=0, progress=20  → happy 😊
//   idle=1, progress=20  → sad 😢
//   idle=3, progress=20  → angry 😠
//   idle=5, progress=20  → sleeping 😴
//   idle=0, progress=100 → celebrating 🎉
//   idle=0, progress=40  → excited 🔥

const {MongoClient, ObjectId} = require('mongodb');
const IDLE_DAYS = parseInt(process.argv[2] || '0', 10);
const PROGRESS  = parseInt(process.argv[3] || '20', 10);
const USER_ID   = '6a4b9f85cc68bde40897fc16';
const USER_OBJ  = new ObjectId(USER_ID);

const MOOD_TABLE = [
  [0,  0,  'neutral 😶'],
  [0,  1,  'happy 😊'],
  [1,  39, 'sad 😢'],
  [1,  40, 'excited 🔥'],
  [3,  0,  'angry 😠'],
  [5,  0,  'sleeping 😴'],
  [0,  100,'celebrating 🎉'],
];

function getMood(idle, pct) {
  if (pct >= 100) return 'celebrating 🎉';
  if (idle >= 5)  return 'sleeping 😴';
  if (idle >= 3)  return 'angry 😠';
  if (idle >= 1 && pct < 40) return 'sad 😢';
  if (idle === 0 && pct === 0) return 'neutral 😶';
  if (idle === 0 && pct >= 40) return 'excited 🔥';
  return 'happy 😊';
}

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  // Upsert watchTime record
  const endTime = new Date(Date.now() - IDLE_DAYS * 86400000);
  await db.collection('watchTime').updateOne(
    {userId: USER_OBJ},
    {'$set': {
      userId: USER_OBJ,
      itemId: new ObjectId('000000000000000000000001'),
      courseId: new ObjectId('000000000000000000000001'),
      courseVersionId: new ObjectId('000000000000000000000001'),
      endTime,
      updatedAt: new Date(),
    }},
    {upsert: true},
  );

  // Also update percentCompleted so we know where we stand
  const existing = await db.collection('enrollments').findOne({userId: USER_OBJ, role: 'STUDENT'});
  if (existing) {
    await db.collection('enrollments').updateOne({_id: existing._id}, {'$set': {percentCompleted: PROGRESS}});
  } else {
    await db.collection('enrollments').insertOne({
      userId: USER_OBJ,
      courseId: new ObjectId('000000000000000000000001'),
      courseVersionId: new ObjectId('000000000000000000000001'),
      role: 'STUDENT', status: 'ACTIVE',
      percentCompleted: PROGRESS, isDeleted: false,
      createdAt: new Date(), updatedAt: new Date(), enrollmentDate: new Date(),
    });
  }

  const mood = getMood(IDLE_DAYS, PROGRESS);
  console.log(`idleDays=${IDLE_DAYS}, progress=${PROGRESS}%`);
  console.log(`Expected mood: ${mood}`);
  console.log(`\nHard-refresh browser (Ctrl+F5) to see the result.`);

  await client.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });