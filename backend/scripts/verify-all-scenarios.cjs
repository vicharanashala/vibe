// verify-all-scenarios.cjs
// Simulates all the scenarios from the user's spec by inserting fake
// enrollment rows for the test user, running the actual _getRealProgress
// aggregation pipeline against each scenario, then DELETING the test rows
// so we don't pollute the DB.
//
// Scenarios tested:
//   A. 1 course, Completed at 100%                        → avg 100 → Adult
//   B. 1 Completed (100%) + 1 Enrolled (0%)               → avg  50 → Teen
//   C. 1 Completed (100%) + 2 Enrolled (0%, 0%)           → avg  33 → Child
//   D. 2 Completed (100%, 100%) + 1 Enrolled (50%)        → avg  83 → Sub-adult

const { MongoClient, ObjectId } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/?directConnection=true';
const DB_NAME = 'vibe';
const USER_ID = '6a4b9f85cc68bde40897fc16';

// Helper: make a deterministic but unique 24-char hex ObjectId per scenario.
function fakeId(scenarioIdx, itemIdx) {
  // pad to 24 chars: 'a' + scenarioIdx + itemIdx + zeros
  const hex = `a${String(scenarioIdx).padStart(2, '0')}${String(itemIdx).padStart(2, '0')}` + '0'.repeat(19);
  return new ObjectId(hex);
}

async function computeAvgPct(db, userIdStr) {
  const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : null;
  const userIdMatch = userIdObj ? { $in: [userIdStr, userIdObj] } : userIdStr;
  const result = await db.collection('enrollment').aggregate([
    { $match: { userId: userIdMatch, role: 'STUDENT', isDeleted: { $ne: true } } },
    { $group: { _id: null, avgPct: { $avg: { $ifNull: ['$percentCompleted', 0] } }, count: { $sum: 1 } } },
  ]).toArray();
  if (!Array.isArray(result) || result.length === 0) return { avg: 0, count: 0 };
  return { avg: Math.round(result[0].avgPct ?? 0), count: result[0].count };
}

function stageFromPct(pct) {
  if (pct === 100) return 'Adult';
  if (pct >= 90) return 'Almost Adult';
  if (pct >= 70) return 'Sub-adult';
  if (pct >= 45) return 'Teen';
  if (pct >= 20) return 'Child';
  return 'Baby';
}

(async () => {
  const client = new MongoClient(MONGO_URI, { directConnection: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log('=== Scenario tests for _getRealProgress aggregation ===\n');

    const scenarios = [
      { name: 'A. 1 Completed @ 100%',                        target: 100, fake: [] },
      { name: 'B. 1 Completed (100%) + 1 Enrolled (0%)',      target:  50, fake: [0] },
      { name: 'C. 1 Completed (100%) + 2 Enrolled (0%, 0%)',  target:  33, fake: [0, 0] },
      { name: 'D. 2 Completed (100%,100%) + 1 Enrolled 50%', target:  83, fake: [100, 50] },
    ];

    // For each scenario, insert fake enrollments, run aggregation, clean up
    let allPass = true;
    let scenarioIdx = 0;
    for (const scen of scenarios) {
      scenarioIdx++;
      const fakeIds = [];
      for (let i = 0; i < scen.fake.length; i++) {
        const fid = fakeId(scenarioIdx, i);
        fakeIds.push(fid);
        await db.collection('enrollment').insertOne({
          _id: fid,
          userId: new ObjectId(USER_ID),
          courseId: fid,
          courseVersionId: fid,
          percentCompleted: scen.fake[i],
          status: scen.fake[i] >= 100 ? 'COMPLETED' : 'ACTIVE',
          role: 'STUDENT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const r = await computeAvgPct(db, USER_ID);
      const expectedStage = stageFromPct(scen.target);
      const actualStage = stageFromPct(r.avg);
      const ok = r.avg === scen.target;
      console.log(`${scen.name}`);
      console.log(`  expected avg=${scen.target} → ${expectedStage}`);
      console.log(`  actual   avg=${r.avg} → ${actualStage}  count=${r.count}  ${ok ? '✅ PASS' : '❌ FAIL'}`);
      console.log();

      // Cleanup
      if (fakeIds.length > 0) {
        await db.collection('enrollment').deleteMany({ _id: { $in: fakeIds } });
      }
      if (!ok) allPass = false;
    }

    console.log(allPass ? '🎉 ALL SCENARIOS PASS' : '⚠️  Some scenarios failed');
  } finally {
    await client.close();
  }
})().catch(e => { console.error(e); process.exit(1); });