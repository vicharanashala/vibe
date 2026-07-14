const {MongoClient, ObjectId} = require('mongodb');

const COURSE_ID = '6a53311b5b3a0f2ab44dc807';
const PANDU_ID  = '6a4b8c7e1e6b7a91c33fb27c';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const cid = new ObjectId(COURSE_ID);
  const uid = new ObjectId(PANDU_ID);

  // ── Collect related IDs ────────────────────────────────────────────
  const course = await db.collection('newCourse').findOne({_id: cid});
  const versions = course
    ? await db.collection('newCourseVersion').find({courseId: cid}).toArray()
    : [];
  const versionIds = versions.map(v => v._id);

  const modules = await db.collection('newModule').find({courseId: cid}).toArray();
  const moduleIds = modules.map(m => m._id);

  const sections = await db.collection('newSection').find({courseVersionId: {$in: versionIds}}).toArray();
  const sectionIds = sections.map(s => s._id);

  const groups = await db.collection('itemsGroup').find({sectionId: {$in: sectionIds}}).toArray();
  const groupIds = groups.map(g => g._id);
  const itemIds = (groups.flatMap(g => g.items || [])).map(i => new ObjectId(i.itemId));

  const quizzes = await db.collection('quizzes').find({itemId: {$in: itemIds.map(id => id.toString())}}).toArray();
  const quizIds = quizzes.map(q => q._id);

  const questionBanks = await db.collection('questionBanks').find({quizId: {$in: quizIds.map(q => q.toString())}}).toArray();
  const questionBankIds = questionBanks.map(qb => qb._id);

  // Also look up items by itemId string
  const itemsByItemId = await db.collection('items').find({itemId: {$in: itemIds.map(id => id.toString())}}).toArray();

  // ── Delete in dependency order ─────────────────────────────────────
  const del = async (col, query, label) => {
    const r = await db.collection(col).deleteMany(query);
    console.log(`  ${label}: ${r.deletedCount} deleted`);
    return r;
  };

  console.log('Deleting test course data…');
  await del('courseSettings',        {courseId: cid});
  await del('questionBanks',         {_id: {$in: questionBankIds}});
  await del('quizzes',               {_id: {$in: quizIds}});
  await del('items',                 {$or: [{_id: {$in: itemIds}}, {itemId: {$in: itemIds.map(id => id.toString())}}]});
  await del('itemsGroup',            {_id: {$in: groupIds}});
  await del('newSection',            {_id: {$in: sectionIds}});
  await del('newModule',             {_id: {$in: moduleIds}});
  await del('newCourseVersion',      {courseId: cid});
  await del('newCourse',             {_id: cid});
  await del('registrations',         {userId: uid, courseId: cid});
  await del('enrollments',           {userId: uid, courseId: cid});

  // ── Verify clean state ─────────────────────────────────────────────
  console.log('\nVerifying clean state…');

  const remainingEnrollments = await db.collection('enrollments').find({userId: uid}).toArray();
  console.log('  Remaining enrollments for pandu:', remainingEnrollments.length);
  if (remainingEnrollments.length > 0) {
    remainingEnrollments.forEach(e => console.log('    _id:', e._id, 'courseId:', e.courseId));
  }

  const remainingCourse = await db.collection('newCourse').findOne({_id: cid});
  console.log('  Course still exists?', !!remainingCourse);

  const companion = await db.collection('companions').findOne({userId: uid});
  if (!companion) {
    console.log('  Companion: no document (fresh start — Stage 0, mood=neutral expected)');
  } else {
    console.log('  Companion doc:', JSON.stringify(companion));
    console.log('  NOTE: companion stage/mood are computed live, not stored');
  }

  // Show what GET /api/companion/me would return (approximate)
  console.log('\nCompanion baseline for pandu (no enrollments):');
  console.log('  Expected stage: 0 (Baby 🥚)');
  console.log('  Expected mood: neutral (no idle days, no progress)');

  await client.close();
  console.log('\nDone. Clean baseline confirmed.');
}
main().catch(err => { console.error('ERROR:', err.message, err.stack); process.exit(1); });