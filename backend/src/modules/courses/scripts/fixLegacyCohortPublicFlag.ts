/**
 * Un-publishes legacy migration-inserted cohorts (isLegacy: true) whose parent
 * course is not public.
 *
 * Background: migrateCohortIds.ts inserted legacy cohort rows with a hardcoded
 * `isPublic: true`. getPublicCatalog() unions public cohorts into the student
 * "Available courses" catalog without checking the parent course's
 * settings.isPublic, so these rows exposed private courses. The rows are also
 * invisible in Manage Cohorts (restricted versions), so there was no UI fix.
 *
 * Dry run : npx ts-node src/modules/courses/scripts/fixLegacyCohortPublicFlag.ts
 * Apply   : npx ts-node src/modules/courses/scripts/fixLegacyCohortPublicFlag.ts --apply
 */
import 'dotenv/config';
import {MongoClient} from 'mongodb';

const MONGO_URI = process.env.DB_URL!;
const DB_NAME = process.env.DB_NAME || 'vibe';
const APPLY = process.argv.includes('--apply');

async function run() {
  if (!MONGO_URI) throw new Error('DB_URL not set');
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const cohorts = await db
      .collection('cohorts')
      .find({isPublic: true, isLegacy: true, isDeleted: {$ne: true}})
      .toArray();

    console.log(`Legacy public cohorts found: ${cohorts.length}`);

    const toFix: any[] = [];

    for (const co of cohorts) {
      const version = await db
        .collection('newCourseVersion')
        .findOne({_id: co.courseVersionId});
      const course = version
        ? await db.collection('newCourse').findOne({_id: version.courseId})
        : null;
      const settings = await db
        .collection('courseSettings')
        .findOne({courseVersionId: co.courseVersionId});

      const coursePublic = settings?.settings?.isPublic === true;

      console.log(
        `  "${co.name}" (${co._id}) course="${course?.name ?? '<missing>'}" coursePublic=${coursePublic}`,
      );

      if (!coursePublic) toFix.push(co);
    }

    console.log(`\nWould set isPublic=false on ${toFix.length} cohort(s).`);

    if (!APPLY) {
      console.log('Dry run — nothing written. Re-run with --apply to write.');
      return;
    }

    for (const co of toFix) {
      const res = await db
        .collection('cohorts')
        .updateOne(
          {_id: co._id},
          {$set: {isPublic: false, updatedAt: new Date()}},
        );
      console.log(`  updated "${co.name}" (${co._id}) matched=${res.matchedCount} modified=${res.modifiedCount}`);
    }

    const remaining = await db
      .collection('cohorts')
      .countDocuments({isPublic: true, isDeleted: {$ne: true}});
    console.log(`\nPublic cohorts remaining DB-wide: ${remaining}`);
  } finally {
    await client.close();
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
