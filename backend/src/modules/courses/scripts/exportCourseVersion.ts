/**
 * READ-ONLY: serialise a course version to a portable JSON bundle on disk.
 * NO WRITES.
 *
 * Usage:
 *   npx tsc
 *   node build/modules/courses/scripts/exportCourseVersion.js <courseId> [versionId] [outFile]
 *
 * Pass "" for versionId to use the course's first version.
 *
 * Everything past reflect-metadata is imported dynamically, through the app's
 * own `loadAppModules('all')` bootstrap: the module index files import one
 * another, and loading them statically from a script entry point trips an ESM
 * temporal-dead-zone error.
 */
import 'reflect-metadata';
import 'dotenv/config';
// src/index.ts pulls these in statically before it calls loadAppModules; that
// ordering is what keeps the module-index cycles resolvable. Mirror it.
import '#root/shared/index.js';
import '#root/container.js';
import {writeFileSync} from 'node:fs';

async function run() {
  const [courseId, versionArg, outArg] = process.argv.slice(2);
  if (!courseId) {
    throw new Error(
      'Usage: node build/modules/courses/scripts/exportCourseVersion.js <courseId> [versionId] [outFile]',
    );
  }

  const {loadAppModules, getContainer} = await import(
    '#root/bootstrap/loadModules.js'
  );
  const {GLOBAL_TYPES} = await import('#root/types.js');
  const {COURSES_TYPES} = await import('#courses/types.js');

  await loadAppModules('all');
  const container = getContainer();

  const db: any = container.get(GLOBAL_TYPES.Database);
  await db.connect();

  const courseRepo: any = container.get(GLOBAL_TYPES.CourseRepo);
  const course = await courseRepo.read(courseId);
  if (!course) {
    throw new Error(`Course ${courseId} not found`);
  }

  const versionId = versionArg || (course.versions || []).map(String)[0];
  if (!versionId) {
    throw new Error(`Course ${courseId} has no versions`);
  }

  console.log(`Course : ${course.name}`);
  console.log(`Version: ${versionId}`);

  const transfer: any = container.get(COURSES_TYPES.CourseTransferService);
  const bundle = await transfer.exportCourseVersion(courseId, versionId);

  const out = outArg || `course-bundle-${courseId}.json`;
  writeFileSync(out, JSON.stringify(bundle, null, 2));

  const sections = bundle.modules.reduce(
    (n: number, m: any) => n + m.sections.length,
    0,
  );
  const byType: Record<string, number> = {};
  let items = 0;
  for (const m of bundle.modules) {
    for (const sec of m.sections) {
      for (const it of sec.items) {
        items++;
        byType[it.type] = (byType[it.type] || 0) + 1;
      }
    }
  }
  const questions = bundle.questionBanks.reduce(
    (n: number, b: any) => n + b.questions.length,
    0,
  );

  console.log(`\nWrote ${out}`);
  console.log(`  modules       : ${bundle.modules.length}`);
  console.log(`  sections      : ${sections}`);
  console.log(`  items         : ${items} ${JSON.stringify(byType)}`);
  console.log(`  question banks: ${bundle.questionBanks.length}`);
  console.log(`  questions     : ${questions}`);

  await (await db.getClient()).close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
