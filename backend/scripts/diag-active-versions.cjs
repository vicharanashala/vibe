// diag-active-versions.cjs — test the exact `getActiveVersions` call
// to see whether our test version is returned.

const { MongoClient, ObjectId } = require('mongodb');

const LEARNER_ID = '6a46ec683f01733f189df8a3';
const COURSE_VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('vibe');

  console.log('=== Simulating getActiveVersions pipeline ===\n');

  const objectIdArray = [new ObjectId(COURSE_VERSION_ID)];

  const courseVersionPipeline = [
    {
      $match: {
        _id: { $in: objectIdArray },
        $or: [
          { versionStatus: "active" },
          { versionStatus: { $exists: false } }
        ]
      }
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

  const courseVersions = await db.collection('newCourseVersion')
    .aggregate(courseVersionPipeline)
    .toArray();

  console.log('Versions returned by getActiveVersions: ' + courseVersions.length);
  for (const v of courseVersions) {
    console.log('  _id: ' + v._id);
    console.log('  versionStatus: ' + v.versionStatus);
    console.log('  modules: ' + v.modules.length);
    if (v.modules[0]) {
      console.log('  first module sections: ' + v.modules[0].sections.length);
      console.log('  section[0] keys: ' + Object.keys(v.modules[0].sections[0] || {}).join(', '));
      console.log('  section[0].itemsGroupId: ' + v.modules[0].sections[0]?.itemsGroupId);
    }
  }

  // Now test the filter chain
  console.log('\n=== Filter chain test ===');
  const enrollment = await db.collection('enrollment').findOne({ _id: new ObjectId('6a50cd31b8ec5d23f45acc47') });
  const enrCourseVersionId = enrollment.courseVersionId.toString();
  console.log('enrollment.courseVersionId: ' + enrCourseVersionId);

  const activeVersionIds = new Set(courseVersions.map(v => v._id.toString()));
  console.log('activeVersionIds set: ' + JSON.stringify([...activeVersionIds]));
  console.log('Filter passes? ' + activeVersionIds.has(enrCourseVersionId));

  // Build versionToItemGroups
  const versionToItemGroups = new Map();
  courseVersions.forEach(version => {
    const itemGroupIds = [];
    version.modules.forEach(module => {
      module.sections.forEach(section => {
        if (section.itemsGroupId) {
          itemGroupIds.push(section.itemsGroupId.toString());
        }
      });
    });
    versionToItemGroups.set(version._id.toString(), itemGroupIds);
  });

  console.log('\nversionToItemGroups:');
  for (const [k, v] of versionToItemGroups.entries()) {
    console.log('  ' + k + ' → ' + v.length + ' itemGroups: ' + v.slice(0, 3));
  }

  // Now check itemsGroup collection
  if (versionToItemGroups.size > 0) {
    const allIds = Array.from(versionToItemGroups.values()).flat();
    console.log('\nAll itemGroup IDs: ' + allIds.length);
    const itemsGroups = await db.collection('itemsGroup').find({ _id: { $in: allIds.map(id => new ObjectId(id)) } }).toArray();
    console.log('Found itemsGroups in DB: ' + itemsGroups.length);
  }

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });