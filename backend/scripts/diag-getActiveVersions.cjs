/**
 * diag-getActiveVersions.cjs
 *
 * Run the EXACT getActiveVersions aggregation pipeline against the test
 * version. Output: does it return the version with proper modules?
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const url = process.env.MONGO_URI_OVERRIDE || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('vibe');

  // Run the EXACT getActiveVersions pipeline
  const versionIds = [VERSION_ID];
  const objectIdArray = versionIds.map(id => new ObjectId(id));

  const pipeline = [
    {
      $match: {
        _id: { $in: objectIdArray },
        $or: [
          { versionStatus: 'active' },
          { versionStatus: { $exists: false } },
        ],
      },
    },
    {
      $set: {
        modules: {
          $map: {
            input: {
              $filter: {
                input: '$modules',
                as: 'mod',
                cond: { $ne: ['$$mod.isDeleted', true] },
              },
            },
            as: 'mod',
            in: {
              moduleId: '$$mod.moduleId',
              name: '$$mod.name',
              description: '$$mod.description',
              order: '$$mod.order',
              createdAt: '$$mod.createdAt',
              updatedAt: '$$mod.updatedAt',
              isDeleted: '$$mod.isDeleted',
              deletedAt: '$$mod.deletedAt',
              isHidden: '$$mod.isHidden',
              sections: {
                $filter: {
                  input: '$$mod.sections',
                  as: 'sec',
                  cond: { $ne: ['$$sec.isDeleted', true] },
                },
              },
            },
          },
        },
      },
    },
  ];

  console.log('=== Running getActiveVersions pipeline ===');
  const result = await db.collection('newCourseVersion').aggregate(pipeline).toArray();
  console.log('count:', result.length);
  result.forEach((v, i) => {
    console.log(`  [${i}] _id: ${v._id?.toString()}`);
    console.log(`    versionStatus: ${v.versionStatus}`);
    console.log(`    modules count: ${v.modules?.length || 0}`);
    v.modules?.forEach((m, mi) => {
      console.log(`      module[${mi}] keys:`, Object.keys(m || {}).join(', '));
      console.log(`        moduleId: ${m.moduleId}`);
      console.log(`        sections count: ${m.sections?.length || 0}`);
      m.sections?.forEach((s, si) => {
        console.log(`          section[${si}] keys:`, Object.keys(s || {}).join(', '));
        console.log(`            sectionId: ${s.sectionId}`);
        console.log(`            itemsGroupId: ${s.itemsGroupId}`);
      });
    });
  });

  if (result.length === 0) {
    console.log('');
    console.log('=== NO VERSIONS RETURNED! Checking raw version doc ===');
    const raw = await db.collection('newCourseVersion').findOne({ _id: new ObjectId(VERSION_ID) });
    if (raw) {
      console.log('Raw doc keys:', Object.keys(raw));
      console.log('  versionStatus:', raw.versionStatus);
      console.log('  modules count:', raw.modules?.length || 0);
      console.log('  modules[0] keys:', Object.keys(raw.modules?.[0] || {}));
      console.log('  modules[0].sections[0] keys:', Object.keys(raw.modules?.[0]?.sections?.[0] || {}));
      console.log('  modules[0].sections[0]:', JSON.stringify(raw.modules?.[0]?.sections?.[0], null, 2));
    } else {
      console.log('Raw version not found!');
    }
  }

  await client.close();
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});