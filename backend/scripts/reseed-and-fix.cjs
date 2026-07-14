// reseed-and-fix.cjs
// One-shot re-seed + cleanup chain:
//   1. Wipe stale test-course-related docs
//   2. Run the original seed-test-course.cjs (creates course + version + video + quiz)
//   3. Run fixup-course-structure.cjs (adds modules[], itemsGroups, questionBank)
//   4. Normalize section.items & module.sections shapes
//   5. Print final state

const { MongoClient, ObjectId } = require('mongodb');
const { spawnSync } = require('child_process');

const TEST_COURSE_NAME = 'Test Drive: Companion Demo';
const LEARNER_EMAIL = 'test.learner@vibe.local';

async function wipe(db) {
  // wipe any partial test-course artifacts from previous failed runs
  const course = await db.collection('newCourse').findOne({ name: TEST_COURSE_NAME });
  if (!course) { console.log('No test course to wipe'); return; }

  console.log('Wiping course ' + course._id);
  const versionIds = (await db.collection('newCourseVersion').find({ courseId: course._id }).toArray()).map(v => v._id);
  const moduleIds = (await db.collection('newModule').find({ courseId: course._id }).toArray()).map(m => m._id);
  const sectionIds = (await db.collection('newSection').find({ courseVersionId: { $in: versionIds } }).toArray()).map(s => s._id);
  const itemsGroupIds = (await db.collection('itemsGroup').find({}).toArray()).filter(g => sectionIds.some(s => s.equals(g.sectionId))).map(g => g._id);

  await db.collection('newCourseVersion').deleteMany({ courseId: course._id });
  await db.collection('newSection').deleteMany({ courseVersionId: { $in: versionIds } });
  await db.collection('newModule').deleteMany({ courseId: course._id });
  await db.collection('itemsGroup').deleteMany({ _id: { $in: itemsGroupIds } });
  await db.collection('newCourse').deleteOne({ _id: course._id });

  // also wipe questionBanks + questions tied to this course
  const banks = await db.collection('questionBank').find({ courseId: course._id.toString() }).toArray();
  const bankIds = banks.map(b => b._id);
  if (bankIds.length) {
    await db.collection('question').deleteMany({ questionBankId: { $in: bankIds } });
    await db.collection('questionBank').deleteMany({ _id: { $in: bankIds } });
  }
  console.log('  Cleaned course+versions+modules+sections+itemsGroups+banks+questions');
}

async function normalize(db) {
  // Fix section.items shape
  const sections = await db.collection('newSection').find({}).toArray();
  let sPatched = 0;
  for (const s of sections) {
    if (!Array.isArray(s.items)) {
      await db.collection('newSection').updateOne(
        { _id: s._id },
        { $set: { items: [] } },
      );
      sPatched++;
    }
  }
  console.log('  Normalized ' + sPatched + ' sections (items -> [])');

  // Fix courseVersion.modules[].sections shape
  const versions = await db.collection('newCourseVersion').find({}).toArray();
  let vPatched = 0;
  for (const v of versions) {
    if (!Array.isArray(v.modules)) continue;
    let needsWrite = false;
    const newModules = v.modules.map(m => {
      if (m && !Array.isArray(m.sections)) {
        needsWrite = true;
        return { ...m, sections: [] };
      }
      return m;
    });
    if (needsWrite) {
      await db.collection('newCourseVersion').updateOne(
        { _id: v._id },
        { $set: { modules: newModules } },
      );
      vPatched++;
    }
  }
  console.log('  Normalized ' + vPatched + ' versions (module.sections -> [])');
}

function runScript(script) {
  console.log('\n>>> Running ' + script);
  const r = spawnSync(process.execPath, ['backend/scripts/' + script], { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error('!!! ' + script + ' exited ' + r.status);
    process.exit(r.status || 1);
  }
}

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  console.log('=== STEP 1: Wipe stale test course ===');
  await wipe(db);

  console.log('\n=== STEP 2: Seed test course ===');
  runScript('seed-test-course.cjs');

  console.log('\n=== STEP 3: Fixup course structure ===');
  runScript('fixup-course-structure.cjs');

  console.log('\n=== STEP 4: Normalize shapes ===');
  await normalize(db);

  console.log('\n=== STEP 5: Final state ===');
  const course = await db.collection('newCourse').findOne({ name: TEST_COURSE_NAME });
  if (!course) { console.error('Test course STILL missing after seed — abort.'); process.exit(1); }
  const version = await db.collection('newCourseVersion').findOne({ courseId: course._id });
  const modules = await db.collection('newModule').countDocuments({ courseId: course._id });
  const sections = await db.collection('newSection').countDocuments({ courseVersionId: version._id });
  const itemsGroups = await db.collection('itemsGroup').countDocuments({});
  const videos = await db.collection('videos').countDocuments({});
  const quizzes = await db.collection('quizzes').countDocuments({});
  const banks = await db.collection('questionBank').countDocuments({ courseId: course._id.toString() });

  console.log('Course:       ' + course._id + ' ("' + course.name + '")');
  console.log('Version:      ' + version._id);
  console.log('Modules:      ' + modules);
  console.log('Sections:     ' + sections);
  console.log('ItemsGroups:  ' + itemsGroups);
  console.log('Videos:       ' + videos);
  console.log('Quizzes:      ' + quizzes);
  console.log('QuestionBanks: ' + banks);

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); console.error(e); process.exit(1); });