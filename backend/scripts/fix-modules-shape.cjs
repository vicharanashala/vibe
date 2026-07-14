// fix-modules-shape.cjs
// Also walk the courseVersion's modules[] to ensure .sections is always [] (not {}).
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  const versions = await db.collection('newCourseVersion').find({}).toArray();
  let patched = 0;
  for (const v of versions) {
    if (!Array.isArray(v.modules)) {
      await db.collection('newCourseVersion').updateOne(
        { _id: v._id },
        { $set: { modules: [] } },
      );
      console.log('  Version ' + v._id + ' modules set to []');
      patched++;
      continue;
    }
    let needsWrite = false;
    const newModules = v.modules.map(m => {
      if (m && !Array.isArray(m.sections)) {
        needsWrite = true;
        console.log('  Module ' + m.moduleId + ' sections was non-array: ' + JSON.stringify(m.sections));
        return { ...m, sections: [] };
      }
      return m;
    });
    if (needsWrite) {
      await db.collection('newCourseVersion').updateOne(
        { _id: v._id },
        { $set: { modules: newModules } },
      );
      patched++;
    }
  }
  console.log('Total versions patched: ' + patched);
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });