/**
 * diag-watchtime-and-quiz.cjs
 *
 * Isolates getWatchedItemCountsBatch, getQuizInfo, and filterCourseVersions
 * from EnrollmentService.getEnrollments STUDENT branch.
 *
 * Why: We need to verify these three downstream lookups return what
 * the service expects for our test learner.
 *
 * Outputs:
 *  - The watchedKey built from `${userId}-${courseId}-${versionId}-${cohortId}`
 *  - watchTime entries with that key
 *  - Distinct item IDs from those entries
 *  - Quiz info entries for any itemsGroup IDs in the version
 *  - The full enrichment result with filterCourseVersions applied
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

const USER_ID = '6a46ec683f01733f189df8a3';
const COURSE_ID = '6a50cb21b59da603242f22ab';
const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const url = process.env.MONGO_URI_OVERRIDE || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGO_DB_NAME || 'vibe';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(dbName);

  console.log('=== enrolledVersionIds ===');
  console.log(`enr.courseVersionId.toString() = ${VERSION_ID}`);
  console.log(`enr.cohortId = ${'undefined'}`);
  console.log('');

  // ===== Step 1: simulate getWatchedItemCountsBatch =====
  // Service code:
  //   const watchedKeys = enrollments.map(e => ({
  //     userId: new ObjectId(userId),
  //     courseId: new ObjectId(e.courseId),
  //     courseVersionId: new ObjectId(e.courseVersionId),
  //     cohortId: e.cohortId,  // raw, may be undefined
  //   }));
  //   const watchedItemsMap = await enrollmentRepo.getWatchedItemCountsBatch(watchedKeys);
  //
  // Inside getWatchedItemCountsBatch:
  //   Builds key `${userId}-${courseId}-${courseVersionId}-${cohortId?.toString() || ''}`
  //   Looks up watchTime collection by that key

  const watchedKey = `${USER_ID}-${COURSE_ID}-${VERSION_ID}-${''}`;
  console.log('=== getWatchedItemCountsBatch sim ===');
  console.log('watchedKey:', watchedKey);

  // Check watchTime collection (try a few common keys)
  const watchTimeByKey = await db.collection('watchTime').find({ key: watchedKey }).toArray();
  const watchTimeCount = watchTimeByKey.length;
  const distinctItemIds = [...new Set(watchTimeByKey.map(e => e.itemId?.toString()).filter(Boolean))];

  console.log('watchTime entries for this key:', watchTimeCount);
  console.log('Distinct itemIds:', distinctItemIds.length, distinctItemIds.slice(0, 5));
  console.log('');

  // ===== Step 2: simulate getQuizInfo =====
  // Get the version to find all itemsGroupIds
  const version = await db.collection('courseVersion').findOne({
    _id: new ObjectId(VERSION_ID),
  });

  const allItemGroupIds = [];
  if (version && version.modules) {
    for (const m of version.modules) {
      if (m.sections) {
        for (const s of m.sections) {
          if (s.itemsGroupId) {
            allItemGroupIds.push(new ObjectId(String(s.itemsGroupId)));
          }
        }
      }
    }
  }
  console.log('=== getQuizInfo sim ===');
  console.log('allItemGroupIds:', allItemGroupIds.length, allItemGroupIds.map(id => id.toString()));

  // Try finding quizzes via the itemsGroup collection
  const itemsGroups = await db
    .collection('itemsGroup')
    .find({ _id: { $in: allItemGroupIds } })
    .toArray();

  console.log('itemsGroup found:', itemsGroups.length);
  const quizInfo = itemsGroups.filter(g => (g.items || []).some(i => i.type === 'QUIZ'));
  console.log('quizInfo entries:', quizInfo.length);
  console.log('');

  // ===== Step 3: itemsGroup structure check =====
  if (itemsGroups.length > 0) {
    const first = itemsGroups[0];
    console.log('=== ItemsGroup structure (first) ===');
    console.log('itemsGroup._id:', first._id.toString());
    console.log('itemsGroup keys:', Object.keys(first));
    console.log('items count:', (first.items || []).length);
    console.log('item[0]:', JSON.stringify(first.items?.[0], null, 2));
    console.log('');
  }

  // ===== Step 4: simulate filterCourseVersions =====
  // course.versions = array of ObjectIds in Course doc
  const course = await db.collection('courses').findOne({
    _id: new ObjectId(COURSE_ID),
  });

  console.log('=== filterCourseVersions sim ===');
  const enrolledVersionIds = new Set([VERSION_ID]);
  console.log('enrolledVersionIds set:', [...enrolledVersionIds]);

  // The enrichment branch reads enr.course.versions, but in
  // the getBasicEnrollments pipeline we projected course down to
  // { name, description, updatedAt } — no `versions` field.
  // So enr.course.versions is undefined → filterCourseVersions returns []
  console.log('enr.course.versions: NOT LOADED (pipeline projects only name/description/updatedAt)');

  if (course) {
    console.log('Actual course.versions:', course.versions?.length || 0);
    course.versions?.forEach(v => {
      console.log(' -', v?.toString?.() || v, '(typeof', typeof v, ')');
    });

    // Now apply the actual filterCourseVersions logic with the real course.versions
    const filtered = course.versions
      ? course.versions
          .map(v => (v && typeof v === 'object' ? v : new ObjectId(String(v))))
          .filter(vId => enrolledVersionIds.has(vId.toString()))
      : [];
    console.log('filtered versions:', filtered.map(v => v.toString()));
  }
  console.log('');

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});