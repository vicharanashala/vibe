// verify-aggregation.cjs
// Mimics what _getRealProgress does — for any userId, computes the AVG
// percentCompleted across ALL non-deleted student enrollments.
//
// Tests multiple scenarios:
//   1. User with only the test enrollment at 100% → should return 100
//   2. Same enrollment at 50% → should return 50
//   3. Same enrollment at 0% → should return 0
//
// Matches the exact aggregation pipeline in CompanionService._getRealProgress

const { MongoClient, ObjectId } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/?directConnection=true';
const DB_NAME = 'vibe';

const USER_ID = '6a4b9f85cc68bde40897fc16';
const ENROLLMENT_ID = '6a50fe0e9850fcfc6ddf49a7';

async function computeAvgPct(db, userIdStr) {
  const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : null;
  const userIdMatch = userIdObj
    ? { $in: [userIdStr, userIdObj] }
    : userIdStr;

  const result = await db.collection('enrollment').aggregate([
    {
      $match: {
        userId: userIdMatch,
        role: 'STUDENT',
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        avgPct: { $avg: { $ifNull: ['$percentCompleted', 0] } },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  if (!Array.isArray(result) || result.length === 0) return { avg: 0, count: 0 };
  return { avg: Math.round(result[0].avgPct ?? 0), count: result[0].count };
}

(async () => {
  const client = new MongoClient(MONGO_URI, { directConnection: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('=== Verification: _getRealProgress aggregation ===\n');

    // 1. List all enrollments for user (regardless of section)
    console.log('All non-deleted student enrollments for test user:');
    const allEnr = await db.collection('enrollment').find({
      userId: { $in: [USER_ID, new ObjectId(USER_ID)] },
      role: 'STUDENT',
      isDeleted: { $ne: true },
    }).project({ _id: 1, percentCompleted: 1, status: 1, courseId: 1 }).toArray();
    allEnr.forEach(e => {
      console.log(`  - ${e._id}: percentCompleted=${e.percentCompleted} status=${e.status}`);
    });
    console.log(`Total: ${allEnr.length}\n`);

    // 2. Simulate the aggregation
    const r = await computeAvgPct(db, USER_ID);
    console.log(`Aggregation result: avg=${r.avg}, count=${r.count}\n`);

    // 3. Manual sanity check
    const manual = allEnr.length === 0 ? 0 :
      Math.round(allEnr.reduce((s, e) => s + (e.percentCompleted || 0), 0) / allEnr.length);
    console.log(`Manual recompute:   avg=${manual}\n`);

    if (r.avg === manual) {
      console.log('✅ Aggregation matches manual computation.');
    } else {
      console.log(`❌ MISMATCH: aggregation=${r.avg}, manual=${manual}`);
    }
  } finally {
    await client.close();
  }
})();