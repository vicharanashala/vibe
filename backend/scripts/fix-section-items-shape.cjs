// fix-section-items-shape.cjs
// Some sections have `items: {}` (empty object) instead of `items: []`.
// Patch them so sortItemsByOrder(...) can spread them safely.
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const db = c.db('vibe');

  const sections = await db.collection('newSection').find({}).toArray();
  console.log('Total sections: ' + sections.length);

  let patched = 0;
  for (const s of sections) {
    const items = s.items;
    // Detect non-array items (object, null, missing, or wrong type)
    const needsFix = items === undefined || items === null ||
      (items && typeof items === 'object' && !Array.isArray(items)) ||
      (Array.isArray(items) && items.length === 0); // already empty array — ok

    if (items !== undefined && !Array.isArray(items)) {
      // really bad — object/null/etc.
      await db.collection('newSection').updateOne(
        { _id: s._id },
        { $set: { items: [] }, $unset: { itemsGroupId: '' } },
      );
      console.log('  PATCHED ' + s._id + ' — was: ' + JSON.stringify(items));
      patched++;
    } else if (Array.isArray(items) && items.some(it => it == null || typeof it !== 'object')) {
      // has array but malformed entries
      await db.collection('newSection').updateOne(
        { _id: s._id },
        { $set: { items: items.filter(it => it != null && typeof it === 'object') } },
      );
      console.log('  CLEANED ' + s._id + ' — kept ' + items.length + ' items');
      patched++;
    } else if (!items) {
      // no items field at all
      await db.collection('newSection').updateOne(
        { _id: s._id },
        { $set: { items: [] } },
      );
      console.log('  ADDED [] to ' + s._id);
      patched++;
    }
  }

  console.log('Total patched: ' + patched);
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });