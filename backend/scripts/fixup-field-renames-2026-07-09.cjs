// scripts/fixup-field-renames-2026-07-09.cjs
// Rename field names in the denormalized copies inside newCourseVersion.modules[]:
//   _id  -> moduleId  (on each module entry)
//   _id  -> sectionId (on each section entry within a module)
//
// Rationale: ItemController.readAllItems walks
//   version.modules.find(m => m.moduleId?.toString() === moduleId)
//   module.sections.find(s => s.sectionId?.toString() === sectionId)
// If we wrote `_id` instead, the lookup misses and we get NotFoundError (404).
//
// Idempotent: re-running renames the field values consistently.

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const VERSION_ID = new ObjectId('6a4f774273de56bebbabd663');

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('=======================================================');
  console.log(' Renaming fields inside newCourseVersion.modules[]');
  console.log('=======================================================');

  const version = await db.collection('newCourseVersion').findOne({_id: VERSION_ID});
  if (!version) {
    console.error('Version not found');
    process.exit(1);
  }
  console.log(`_id=${version._id}  modules.length=${version.modules?.length || 0}`);

  if (!version.modules || version.modules.length === 0) {
    console.error('No modules in version, nothing to rename');
    process.exit(1);
  }

  let modulesTouched = 0;
  let sectionsTouched = 0;
  for (const m of version.modules) {
    // Module: _id -> moduleId
    if (m._id && !m.moduleId) {
      m.moduleId = m._id;
      modulesTouched++;
    }
    // Section: _id -> sectionId (also rename other section fields if needed)
    if (m.sections) {
      for (const s of m.sections) {
        if (s._id && !s.sectionId) {
          s.sectionId = s._id;
          sectionsTouched++;
        }
      }
    }
  }

  await db.collection('newCourseVersion').updateOne(
    {_id: VERSION_ID},
    {$set: {modules: version.modules, updatedAt: new Date()}},
  );

  console.log(`Renamed ${modulesTouched} module(s) and ${sectionsTouched} section(s) on the denormalized copy.`);

  // Also verify the top-level fields actually got renamed
  const verify = await db.collection('newCourseVersion').findOne({_id: VERSION_ID});
  console.log('\nVerification:');
  for (const m of verify.modules) {
    console.log(`  module: _id=${m._id} moduleId=${m.moduleId}  sections=${(m.sections || []).length}`);
    for (const s of m.sections || []) {
      console.log(`    section: _id=${s._id} sectionId=${s.sectionId} itemsGroupId=${s.itemsGroupId}`);
    }
  }

  // Quick sanity: does the items lookup endpoint find this now?
  // We can't HTTP-fetch without a token, but we can verify via direct Mongo query
  console.log('\nDirect Mongo sanity check:');
  const found = verify.modules.find(m => String(m.moduleId) === String(verify.modules[0].moduleId));
  const secFound = found?.sections?.find(s => String(s.sectionId) === String(found.sections[0].sectionId));
  console.log(`  look up module by moduleId: ${found ? 'OK' : 'NOT FOUND'}`);
  console.log(`  look up section by sectionId: ${secFound ? 'OK' : 'NOT FOUND'}`);

  await client.close();
  console.log('\nDone. In the browser, hard-refresh and revisit the section page.');
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});