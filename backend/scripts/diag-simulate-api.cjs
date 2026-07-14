#!/usr/bin/env node
// diag-simulate-api.cjs — Simulate exactly what the backend CourseVersionService
// does for readCourseVersion, bypassing HTTP/auth. Runs the same Mongo pipeline
// and filter steps the API would, then prints the result.

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';
const VERSION_ID = '6a50cb21b59da603242f22ac';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  SIMULATED API: readCourseVersion                            │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // Step 1: getActiveVersion (with the same $filter on isDeleted)
    const pipeline = [
      { $match: { _id: new ObjectId(VERSION_ID) } },
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

    const versionArr = await db
      .collection('newCourseVersion')
      .aggregate(pipeline)
      .toArray();

    const version = versionArr[0];
    if (!version) {
      console.log('❌ Version not found');
      return;
    }

    console.log('Step 1: getActiveVersion (after isDeleted filter)');
    console.log(`  modules.length: ${version.modules?.length ?? 0}`);
    for (const m of version.modules || []) {
      console.log(`  • ${m.name} (isHidden=${m.isHidden}) — sections: ${m.sections?.length ?? 0}`);
      for (const s of m.sections || []) {
        console.log(`      order=${s.order} sectionId=${s.sectionId} isHidden=${s.isHidden}`);
      }
    }

    // Step 2: simulate CourseVersionService logic (filter by !isHidden for students)
    let modules = version.modules
      .filter((module) => !module.isHidden)
      .map((module) => {
        const visibleSections = module.sections.filter((section) => !section.isHidden);
        return { ...module, sections: visibleSections };
      });

    console.log('\nStep 2: After STUDENT isHidden filter');
    console.log(`  modules.length: ${modules.length}`);
    for (const m of modules) {
      console.log(`  • ${m.name} — sections: ${m.sections?.length ?? 0}`);
      for (const s of m.sections || []) {
        console.log(`      order=${s.order} sectionId=${s.sectionId} itemsGroupId=${s.itemsGroupId}`);
      }
    }

    // Step 3: sortItemsByOrder (with the patched defensive guard)
    const sortByOrder = (items) => {
      // Defensive: some sections have `items: {}` instead of `items: []`
      if (!items || typeof items[Symbol.iterator] !== 'function') return [];
      return [...items].sort((a, b) =>
        String(a?.order || '').localeCompare(String(b?.order || '')),
      );
    };

    modules = sortByOrder(modules).map((module) => ({
      ...module,
      sections: sortByOrder(module.sections).map((section) => ({
        ...section,
        items: sortByOrder(section.items),
      })),
    }));

    console.log('\nStep 3: After sortItemsByOrder');
    console.log(`  modules.length: ${modules.length}`);
    for (const m of modules) {
      console.log(`  • ${m.name} (moduleId=${m.moduleId}) — sections: ${m.sections?.length ?? 0}`);
      for (const s of m.sections || []) {
        console.log(`      order=${s.order} sectionId=${s.sectionId} itemsGroupId=${s.itemsGroupId}`);
      }
    }

    // Final answer — what the API would return
    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  FINAL API OUTPUT (what frontend receives)                    │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');
    console.log(JSON.stringify({ modules }, null, 2).slice(0, 4000));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();