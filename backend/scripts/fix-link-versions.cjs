#!/usr/bin/env node
// fix-link-versions.cjs — Link the orphaned itemsGroups/items/videos/quizzes to the
// test course version (6a50cb21b59da603242f22ac). Without this, the frontend can't
// render the module view because itemsGroup.items is undefined.
//
// Strategy:
//   1. Match each itemsGroup with its section by index in the version.modules[0].sections
//   2. Match items/videos to itemsGroups by createdAt order (oldest = section 1, etc)
//   3. Match quizzes to their items by name → groupId

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
    console.log('│  FIX ORPHAN COURSE CONTENT (link itemsGroups → version)     │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const versionIdObj = new ObjectId(VERSION_ID);

    // 1. Get the version's sections in order
    const version = await db.collection('newCourseVersion').findOne({ _id: versionIdObj });
    if (!version) {
      console.log('❌ Version not found');
      return;
    }
    const sections = version.modules?.[0]?.sections ?? [];
    console.log(`📐 Version has ${sections.length} sections referenced:\n`);
    for (const s of sections) {
      console.log(`  • sectionId=${s.sectionId}  itemsGroupId=${s.itemsGroupId}  order=${s.order}`);
    }

    // 2. Update each itemsGroup to have courseVersionId
    console.log('\n🔧 Linking itemsGroups → courseVersionId:');
    for (const s of sections) {
      const result = await db.collection('itemsGroup').updateOne(
        { _id: new ObjectId(s.itemsGroupId) },
        {
          $set: {
            courseVersionId: versionIdObj,
            courseId: version.courseId,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
      );
      console.log(`  • itemsGroup ${s.itemsGroupId}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    }

    // 3. Match items to itemsGroups (by creation order within the items collection)
    const items = await db.collection('items').find({}).sort({ createdAt: 1 }).toArray();
    console.log(`\n🔧 Linking ${items.length} items → courseVersionId + itemsGroupId (by createdAt order):`);
    for (let i = 0; i < items.length && i < sections.length; i++) {
      const item = items[i];
      const section = sections[i];
      const result = await db.collection('items').updateOne(
        { _id: item._id },
        {
          $set: {
            courseVersionId: versionIdObj,
            courseId: version.courseId,
            itemsGroupId: new ObjectId(section.itemsGroupId),
            updatedAt: new Date(),
          },
        },
      );
      console.log(`  • item ${item._id.toString()} (${item.name}, ${item.type}): linked to section ${section.order}`);
    }

    // 4. Match videos: same as items (videos collection is also used)
    const videos = await db.collection('videos').find({}).sort({ createdAt: 1 }).toArray();
    console.log(`\n🔧 Linking ${videos.length} videos → courseVersionId + itemsGroupId:`);
    for (let i = 0; i < videos.length && i < sections.length; i++) {
      const v = videos[i];
      const section = sections[i];
      await db.collection('videos').updateOne(
        { _id: v._id },
        {
          $set: {
            courseVersionId: versionIdObj,
            itemsGroupId: new ObjectId(section.itemsGroupId),
            updatedAt: new Date(),
          },
        },
      );
      console.log(`  • video ${v._id.toString()} (${v.title}): linked to section ${section.order}`);
    }

    // 5. Quizzes are referenced by items.type === 'QUIZ' and items._id often matches quiz id
    console.log(`\n🔧 Linking quizzes → courseVersionId + itemsGroupId:`);
    for (const item of items) {
      if (item.type !== 'QUIZ') continue;
      // Find matching quiz (by _id match since items row is the quiz)
      const result = await db.collection('quizzes').updateOne(
        { _id: item._id },
        {
          $set: {
            courseVersionId: versionIdObj,
            itemsGroupId: new ObjectId(item.itemsGroupId),
            updatedAt: new Date(),
          },
        },
      );
      console.log(`  • quiz ${item._id.toString()}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    }

    // 6. Also link all sections to courseVersionId (some have it, some don't)
    console.log(`\n🔧 Linking sections → courseVersionId:`);
    for (const s of sections) {
      const result = await db.collection('newSection').updateOne(
        { _id: new ObjectId(s.sectionId) },
        {
          $set: {
            courseVersionId: versionIdObj,
            courseId: version.courseId,
            updatedAt: new Date(),
          },
        },
      );
      console.log(`  • section ${s.sectionId}: matched=${result.matchedCount}`);
    }

    console.log('\n✅ Done. Hard-refresh the dashboard and the course should now render.');
    console.log('>>> Restart backend if needed (Task Manager → kill node.exe → pnpm dev)');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();