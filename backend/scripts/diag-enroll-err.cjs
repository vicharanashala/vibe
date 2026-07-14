// diagnostic-trace.cjs
// Just check what shape the test course data has right now
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  // The freshest seed's courseId
  const course = await db.collection('newCourse').findOne(
    { name: 'Test Drive: Companion Demo' },
    { sort: { createdAt: -1 } },
  );
  if (!course) {
    console.log('No test course found.');
    return c.close();
  }
  const courseId = course._id;
  const version = await db.collection('newCourseVersion').findOne({ courseId });
  console.log('Course:', courseId, 'Version:', version._id, 'modules count:', (version.modules || []).length);

  for (const mod of (version.modules || [])) {
    console.log('  moduleId=' + mod.moduleId + ' sections=' + (mod.sections || []).length);
    for (const sec of (mod.sections || [])) {
      const sectionDoc = await db.collection('newSection').findOne({ _id: sec.sectionId });
      const ig = await db.collection('itemsGroup').findOne({ _id: sec.itemsGroupId });
      console.log('    sectionId=' + sec.sectionId + ' itemsGroupId=' + sec.itemsGroupId);
      console.log('      newSection doc found: ' + !!sectionDoc);
      console.log('      itemsGroup doc found: ' + !!ig);
      if (ig) {
        console.log('      itemsGroup.items.length=' + (ig.items || []).length);
        for (const it of (ig.items || [])) {
          const typedV = await db.collection('videos').findOne({ _id: it._id });
          const typedQ = await db.collection('quizzes').findOne({ _id: it._id });
          console.log('        item._id=' + it._id + ' type=' + it.type + ' typedVideo=' + !!typedV + ' typedQuiz=' + !!typedQ);
        }
      }
    }
  }

  await c.close();
})().catch(e => { console.error(e); process.exit(1); });