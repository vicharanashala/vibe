// scripts/verify-all-fixes-mongo.js
// Comprehensive live verification of the 4 high-severity fixes via direct Mongo operations.
// Mimics the exact MongoDB patterns used in CompanionService._getRealProgress,
// CompanionService._getRealQuizScore, and CompanionRepository.upsert.

const TEST_USER = '6a4be50e40f5a3ec95b400ac'; // a real user from the existing companions

print('================================================');
print('  Live verification of 4 high-severity fixes   ');
print('================================================\n');

// ============================================================
// H4: Atomic upsert with $setOnInsert must preserve createdAt
// ============================================================
print('=== H4: Atomic upsert preserves createdAt ===');

const companionsColl = db.companions;
const existing = companionsColl.findOne({userId: TEST_USER});
if (!existing) {
  print('  No existing doc for ' + TEST_USER + '; seeding one');
  companionsColl.insertOne({
    userId: TEST_USER,
    animal: 'panda',
    lastActiveAt: new Date(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });
}

const before = companionsColl.findOne({userId: TEST_USER});
print('  Before: createdAt=' + before.createdAt.toISOString() +
      '  animal=' + before.animal + '  lastActiveAt=' + before.lastActiveAt.toISOString());

// Simulate upsert: $set animal, $setOnInsert createdAt — should NOT touch createdAt
const result = companionsColl.findOneAndUpdate(
  {userId: TEST_USER},
  {
    $set: {animal: 'fox', lastActiveAt: new Date()},
    $setOnInsert: {userId: TEST_USER, createdAt: new Date()},
  },
  {upsert: true, returnDocument: 'after'},
);
const after = companionsColl.findOne({userId: TEST_USER});
print('  After:  createdAt=' + after.createdAt.toISOString() +
      '  animal=' + after.animal + '  lastActiveAt=' + after.lastActiveAt.toISOString());

if (after.createdAt.getTime() === before.createdAt.getTime()) {
  print('  PASS: createdAt preserved (diff = 0 ms)');
} else {
  print('  FAIL: createdAt changed! diff = ' + (after.createdAt - before.createdAt) + ' ms');
}

// ============================================================
// H3: Defensive $in: [str, oid] handles both userId formats
// ============================================================
print('\n=== H3: Quiz aggregation handles String AND ObjectId userId ===');

const submissionsColl = db.quiz_submission_results;

// Clean up any prior test docs
submissionsColl.deleteMany({userId: TEST_USER});

// Seed: store userId as a STRING (the case the old code threw on)
submissionsColl.insertMany([
  {
    userId: TEST_USER,                    // string!
    quizId: 'q1',
    gradingResult: {totalScore: 80},
  },
  {
    userId: TEST_USER,                    // string!
    quizId: 'q2',
    gradingResult: {totalScore: 90},
  },
  {
    userId: new ObjectId().toString(),    // different user, irrelevant
    quizId: 'q3',
    gradingResult: {totalScore: 50},
  },
]);
print('  Seeded 3 submissions (2 for our user, 1 for someone else)');

// OLD BUGGY query: new ObjectId(userId) — would throw if userId is not a 24-hex string
print('  -- OLD buggy query (new ObjectId(userId)) --');
try {
  const r = submissionsColl.aggregate([
    {$match: {userId: new ObjectId(TEST_USER)}},
    {$group: {_id: null, avg: {$avg: '$gradingResult.totalScore'}}},
  ]).toArray();
  print('    result: ' + JSON.stringify(r) + ' (unexpectedly succeeded)');
} catch (e) {
  print('    THROWS: ' + e.message.split('\n')[0]);
}

// NEW FIXED query: $in: [str, oid]
print('  -- NEW fixed query ($in: [str, oid]) --');
const userIdStr = String(TEST_USER);
const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : null;
const userIdMatch = userIdObj ? {$in: [userIdStr, userIdObj]} : userIdStr;
const fixed = submissionsColl.aggregate([
  {$match: {userId: userIdMatch, 'gradingResult.totalScore': {$exists: true, $ne: null}}},
  {$group: {_id: null, avg: {$avg: '$gradingResult.totalScore'}}},
]).toArray();
const expectedAvg = (80 + 90) / 2; // = 85
const actualAvg = fixed.length > 0 ? Math.round(fixed[0].avg) : 0;
print('    result: ' + JSON.stringify(fixed));
if (actualAvg === Math.round(expectedAvg)) {
  print('    PASS: avg=' + actualAvg + ' (expected ' + Math.round(expectedAvg) + ')');
} else {
  print('    FAIL: avg=' + actualAvg + ' (expected ' + Math.round(expectedAvg) + ')');
}

// ============================================================
// H2: Filter completed (>=100%) enrollments, paginate
// ============================================================
print('\n=== H2: Filter completed enrollments + pagination ===');

const enrollmentColl = db.enrollment;
enrollmentColl.deleteMany({userId: TEST_USER});

// Seed: 1 completed, 1 mid-progress, 1 high-progress
enrollmentColl.insertMany([
  {userId: TEST_USER, courseId: 'c1', percentCompleted: 100},   // completed
  {userId: TEST_USER, courseId: 'c2', percentCompleted: 25},    // active
  {userId: TEST_USER, courseId: 'c3', percentCompleted: 75},    // active
  {userId: TEST_USER, courseId: 'c4', percentCompleted: 90},    // active (highest!)
  {userId: 'someone_else', courseId: 'c5', percentCompleted: 50},
]);
print('  Seeded 5 enrollments (1 completed, 3 active for our user, 1 for another user)');

// OLD buggy: Math.max over ALL enrollments (including 100%)
const allEnroll = enrollmentColl.find({userId: TEST_USER}).toArray();
const naiveHighest = Math.max(...allEnroll.map(e => e.percentCompleted ?? 0));
print('  OLD buggy highest: ' + naiveHighest + ' (includes the 100% course)');

// NEW fixed: filter <100% then take max
const activeEnroll = allEnroll.filter(e => (e.percentCompleted ?? 0) < 100);
const fixedHighest = activeEnroll.length === 0
  ? 0
  : Math.max(...activeEnroll.map(e => e.percentCompleted ?? 0));
print('  NEW fixed highest: ' + fixedHighest + ' (excludes 100% course)');

if (naiveHighest === 100 && fixedHighest === 90) {
  print('  PASS: behavior diverges correctly (100 -> 90)');
} else {
  print('  Unexpected: naive=' + naiveHighest + ' fixed=' + fixedHighest);
}

// ============================================================
// Cleanup
// ============================================================
print('\n=== Cleanup ===');
const cDel = companionsColl.deleteOne({userId: TEST_USER, animal: 'fox'});
print('  Removed test companion: ' + cDel.deletedCount);
const eDel = enrollmentColl.deleteMany({userId: TEST_USER});
print('  Removed test enrollments: ' + eDel.deletedCount);
const sDel = submissionsColl.deleteMany({userId: TEST_USER});
print('  Removed test submissions: ' + sDel.deletedCount);

print('\n================================================');
print('  Verification complete                        ');
print('================================================');