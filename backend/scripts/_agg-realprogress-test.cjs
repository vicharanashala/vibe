const {MongoClient, ObjectId} = require('mongodb');

const USER_ID = '6a4b9f85cc68bde40897fc16';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const userIdStr = String(USER_ID);
  const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : null;
  const userIdMatch = userIdObj ? {$in: [userIdStr, userIdObj]} : userIdStr;

  // Try 'enrollment' collection (singular, as CompanionService uses)
  let result = await db.collection('enrollment').aggregate([
    {$match: {userId: userIdMatch, role: 'STUDENT', isDeleted: {$ne: true}}},
    {$group: {_id: null, avgPct: {$avg: {$ifNull: ['$percentCompleted', 0]}}, count: {$sum: 1}}},
  ]).toArray();
  console.log("Collection 'enrollment':", JSON.stringify(result));

  // Also try 'enrollments' (plural)
  result = await db.collection('enrollments').aggregate([
    {$match: {userId: userIdMatch, role: 'STUDENT', isDeleted: {$ne: true}}},
    {$group: {_id: null, avgPct: {$avg: {$ifNull: ['$percentCompleted', 0]}}, count: {$sum: 1}}},
  ]).toArray();
  console.log("Collection 'enrollments':", JSON.stringify(result));

  // Check what collections actually exist with 'enroll' in the name
  const allCols = await db.listCollections().toArray();
  const enrollCols = allCols.filter(c => c.name.includes('enroll'));
  console.log('\nCollections with "enroll" in name:', enrollCols.map(c => c.name));

  await client.close();
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });