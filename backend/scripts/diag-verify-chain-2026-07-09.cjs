// scripts/diag-verify-chain-2026-07-09.cjs
// Verify the full chain the controller walks:
//   1) newCourseVersion with modules[].sections[] containing moduleId/sectionId/itemsGroupId
//   2) newModule doc (or it's only denormalized on the version?)
//   3) newSection doc (or only denormalized on the version?)
//   4) itemsGroup doc matching the itemsGroupId
//   5) Each ItemRef inside has _id, type, order (string), name, isHidden

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const VERSION_ID = new ObjectId('6a4f774273de56bebbabd663');
const SECTION_ID = new ObjectId('6a4f774273de56bebbabd664');
const ITEMSGROUP_ID = new ObjectId('6a4f774273de56bebbabd666');

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('=== 1) Version document ===');
  const v = await db.collection('newCourseVersion').findOne({_id: VERSION_ID});
  console.log(`version: ${v._id} courseId=${v.courseId} modules.length=${v.modules?.length}`);
  for (const m of v.modules || []) {
    console.log(`  module: _id=${m._id} moduleId=${m.moduleId} (${typeof m.moduleId}) sections=${(m.sections||[]).length}`);
    for (const s of m.sections || []) {
      console.log(`    section: _id=${s._id} sectionId=${s.sectionId} (${typeof s.sectionId}) itemsGroupId=${s.itemsGroupId} (${typeof s.itemsGroupId})`);
    }
  }

  console.log('');
  console.log('=== 2) ItemsGroup by raw _id lookup (string + ObjectId) ===');
  const g_str = await db.collection('itemsGroup').findOne({_id: ITEMSGROUP_ID.toString()});
  const g_oid = await db.collection('itemsGroup').findOne({_id: ITEMSGROUP_ID});
  console.log(`  by string: ${g_str ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`  by ObjectId: ${g_oid ? 'FOUND' : 'NOT FOUND'}`);
  if (g_oid) {
    console.log(`  items.length=${g_oid.items?.length || 0}`);
    for (const it of g_oid.items || []) {
      console.log(`    item: _id=${it._id} (${typeof it._id}) itemId=${it.itemId} type=${it.type} order=${typeof it.order === 'string' ? '"'+it.order+'"' : it.order} name="${it.name}" isHidden=${it.isHidden}`);
    }
  }

  console.log('');
  console.log('=== 3) Try query as the controller does ===');
  // The service calls readItemsGroup(section.itemsGroupId.toString(), session)
  // If the repo does `findOne({_id: new ObjectId(id)})` then string lookup should work
  const idAsString = ITEMSGROUP_ID.toString();
  console.log(`  idAsString: ${idAsString}`);
  try {
    const directId = new ObjectId(idAsString);
    console.log(`  re-parse: ${directId.toString() === idAsString ? 'OK' : 'MISMATCH'}`);
    const g_via_reparse = await db.collection('itemsGroup').findOne({_id: directId});
    console.log(`  via reparse: ${g_via_reparse ? 'FOUND' : 'NOT FOUND'}`);
  } catch (e) {
    console.log(`  re-parse failed: ${e.message}`);
  }

  console.log('');
  console.log('=== 4) Enrollment row ===');
  const enrollment = await db.collection('enrollment').findOne({
    userId: new ObjectId('6a4b9f85cc68bde40897fc16'),
    courseVersionId: VERSION_ID,
  });
  if (enrollment) {
    console.log(`  _id=${enrollment._id} userId=${enrollment.userId} role=${enrollment.role} status=${enrollment.status}`);
    console.log(`  cohortId=${enrollment.cohortId} (${typeof enrollment.cohortId})`);
  } else {
    console.log('  NOT FOUND');
  }

  console.log('');
  console.log('=== 5) Progress row ===');
  const progress = await db.collection('progress').findOne({
    userId: new ObjectId('6a4b9f85cc68bde40897fc16'),
    courseVersionId: VERSION_ID,
  });
  if (progress) {
    console.log(`  _id=${progress._id} currentModule=${progress.currentModule} currentSection=${progress.currentSection} currentItem=${progress.currentItem} completed=${progress.completed}`);
    console.log(`  cohortId=${progress.cohortId} (${typeof progress.cohortId})`);
  } else {
    console.log('  NOT FOUND');
  }

  await client.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});