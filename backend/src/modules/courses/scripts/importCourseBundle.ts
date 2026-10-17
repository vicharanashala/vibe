/**
 * Imports a course bundle produced by exportCourseVersion.ts into whatever
 * database DB_URL points at, then reads the result back and prints a
 * structural comparison against the bundle.
 *
 * WRITES: creates one course, one version, its item documents, question banks
 * and questions, plus a course-settings doc and an INSTRUCTOR enrollment.
 *
 * Usage:
 *   npx tsc
 *   node build/modules/courses/scripts/importCourseBundle.js <bundleFile> [importerUserId]
 *
 * Omit importerUserId to create a throwaway user to own the imported course.
 */
import 'reflect-metadata';
import 'dotenv/config';
// Mirrors src/index.ts: these must load statically before loadAppModules, or
// the module-index import cycles hit an ESM temporal-dead-zone error.
import '#root/shared/index.js';
import '#root/container.js';
import {readFileSync} from 'node:fs';

async function run() {
  const [bundleFile, importerArg] = process.argv.slice(2);
  if (!bundleFile) {
    throw new Error(
      'Usage: node build/modules/courses/scripts/importCourseBundle.js <bundleFile> [importerUserId]',
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

  const bundle = JSON.parse(readFileSync(bundleFile, 'utf8'));

  const userRepo: any = container.get(GLOBAL_TYPES.UserRepo);
  let importerId = importerArg;
  if (!importerId) {
    importerId = await userRepo.create({
      firebaseUID: `import-script-${Date.now()}`,
      email: `import-script-${Date.now()}@example.invalid`,
      firstName: 'Import',
      lastName: 'Script',
      roles: 'admin',
    });
    console.log(`Created importing user ${importerId}`);
  }

  const transfer: any = container.get(COURSES_TYPES.CourseTransferService);

  console.log(`Importing "${bundle.course.name}" (${bundle.version.version})…`);
  const started = Date.now();
  const created = await transfer.importCourse(bundle, importerId);
  console.log(
    `Imported in ${((Date.now() - started) / 1000).toFixed(1)}s -> course ${created.courseId} version ${created.versionId}`,
  );
  console.log(`Created as: "${created.name}"`);

  // --- read the result back and compare against the bundle -----------------
  const courseRepo: any = container.get(GLOBAL_TYPES.CourseRepo);
  const itemRepo: any = container.get(COURSES_TYPES.ItemRepo);
  const bankRepo: any = container.get(
    (await import('#root/modules/quizzes/types.js')).QUIZZES_TYPES
      .QuestionBankRepo,
  );

  const version = await courseRepo.readVersion(created.versionId);

  const expected = {
    modules: bundle.modules.length,
    sections: bundle.modules.reduce((n: number, m: any) => n + m.sections.length, 0),
    items: bundle.modules.reduce(
      (n: number, m: any) =>
        n + m.sections.reduce((s: number, sec: any) => s + sec.items.length, 0),
      0,
    ),
    banks: bundle.questionBanks.length,
    questions: bundle.questionBanks.reduce(
      (n: number, b: any) => n + b.questions.length,
      0,
    ),
  };

  let actualItems = 0;
  let orderMismatches = 0;
  let nameMismatches = 0;
  const bankIds = new Set<string>();
  let quizzesWithBanks = 0;

  for (const [mi, module] of version.modules.entries()) {
    const bundleModule = bundle.modules[mi];
    if (module.name !== bundleModule.name) nameMismatches++;
    for (const [si, section] of module.sections.entries()) {
      const bundleSection = bundleModule.sections[si];
      if (section.name !== bundleSection.name) nameMismatches++;
      const group = await itemRepo.readItemsGroup(section.itemsGroupId.toString());
      actualItems += group.items.length;
      for (const [ii, ref] of group.items.entries()) {
        const bundleItem = bundleSection.items[ii];
        if (!bundleItem) continue;
        if (ref.name !== bundleItem.name) nameMismatches++;
        if (ref.order !== bundleItem.order) orderMismatches++;
        if (bundleItem.type === 'QUIZ') {
          const item = await itemRepo.readItemById(ref._id.toString());
          const refs = item?.details?.questionBankRefs || [];
          if (refs.length) quizzesWithBanks++;
          for (const r of refs) bankIds.add(r.bankId.toString());
        }
      }
    }
  }

  let actualQuestions = 0;
  for (const bankId of bankIds) {
    const bank = await bankRepo.getById(bankId);
    actualQuestions += (bank?.questions || []).length;
  }

  const row = (label: string, exp: any, act: any) =>
    console.log(
      `  ${label.padEnd(16)} expected ${String(exp).padStart(5)}   got ${String(act).padStart(5)}   ${exp === act ? 'OK' : 'MISMATCH'}`,
    );

  console.log('\n--- structural comparison ---');
  row('modules', expected.modules, version.modules.length);
  row(
    'sections',
    expected.sections,
    version.modules.reduce((n: number, m: any) => n + m.sections.length, 0),
  );
  row('items', expected.items, actualItems);
  row('items (counted)', expected.items, version.totalItems);
  row('question banks', expected.banks, bankIds.size);
  row('questions', expected.questions, actualQuestions);
  console.log(`  quizzes wired to a bank: ${quizzesWithBanks}`);
  console.log(`  name mismatches        : ${nameMismatches}`);
  console.log(`  item order mismatches  : ${orderMismatches}`);
  console.log(`  itemCounts             : ${JSON.stringify(version.itemCounts)}`);

  const settingsRepo: any = container.get(
    (await import('#root/modules/setting/types.js')).SETTING_TYPES.SettingRepo,
  );
  const settings = await settingsRepo.readCourseSettings(
    created.courseId,
    created.versionId,
  );
  console.log(
    `  settings               : seekForward=${settings?.settings?.seekForwardEnabled} linearProgression=${settings?.settings?.linearProgressionEnabled} isPublic=${settings?.settings?.isPublic} audit=${settings?.settings?.audit === undefined ? 'absent' : 'PRESENT'}`,
  );

  await (await db.getClient()).close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
