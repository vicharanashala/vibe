/**
 * Seeds (or re-syncs) a course version's case-study bank from a
 * version-controlled JSON file — the sole authoring path for case-study
 * content in this build. There is no teacher-facing authoring form; the
 * CRUD endpoints on CaseStudyController exist for operational fixes
 * (reordering, wording corrections), not for writing new cases.
 *
 * The seed file's schema (see data/case-studies.seed.json) intentionally has
 * no answer, rubric, or expected-response field — case studies are open
 * prompts, scored only by peer pairwise comparison, never against a
 * reference answer.
 *
 * Idempotent: re-running upserts by (courseVersionId, sequenceIndex), so
 * editing the JSON file and re-running syncs the change without duplicating
 * cases.
 *
 * Usage:
 *   npx tsc
 *   node build/modules/caseStudies/scripts/seedCaseStudies.js <courseVersionId> [seedFile]
 *
 * Omit seedFile to use the bundled data/case-studies.seed.json.
 */
import 'reflect-metadata';
import 'dotenv/config';
// Mirrors src/index.ts: these must load statically before loadAppModules, or
// the module-index import cycles hit an ESM temporal-dead-zone error.
import '#root/shared/index.js';
import '#root/container.js';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

interface SeedEntry {
  sequenceIndex: number;
  title: string;
  bodyMarkdown: string;
  linkedItemId?: string;
}

function validateEntries(entries: unknown): SeedEntry[] {
  if (!Array.isArray(entries)) {
    throw new Error('Seed file must be a JSON array of case-study entries.');
  }
  const seen = new Set<number>();
  for (const entry of entries) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as any).sequenceIndex !== 'number' ||
      typeof (entry as any).title !== 'string' ||
      typeof (entry as any).bodyMarkdown !== 'string'
    ) {
      throw new Error(
        `Invalid seed entry (needs numeric sequenceIndex, string title, string bodyMarkdown): ${JSON.stringify(entry)}`,
      );
    }
    if ('answer' in (entry as any) || 'rubric' in (entry as any) || 'modelResponse' in (entry as any)) {
      throw new Error(
        `Seed entry at sequenceIndex ${(entry as any).sequenceIndex} carries an answer/rubric/modelResponse field — case studies must never ship a reference answer.`,
      );
    }
    const sequenceIndex = (entry as any).sequenceIndex;
    if (seen.has(sequenceIndex)) {
      throw new Error(`Duplicate sequenceIndex ${sequenceIndex} in seed file.`);
    }
    seen.add(sequenceIndex);
  }
  return entries as SeedEntry[];
}

async function run() {
  const [courseVersionId, seedFileArg] = process.argv.slice(2);
  if (!courseVersionId) {
    throw new Error(
      'Usage: node build/modules/caseStudies/scripts/seedCaseStudies.js <courseVersionId> [seedFile]',
    );
  }

  const defaultSeedFile = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../data/case-studies.seed.json',
  );
  const seedFile = seedFileArg ?? defaultSeedFile;

  const {loadAppModules, getContainer} = await import(
    '#root/bootstrap/loadModules.js'
  );
  const {GLOBAL_TYPES} = await import('#root/types.js');
  const {CASE_STUDIES_TYPES} = await import('#root/modules/caseStudies/types.js');

  await loadAppModules('all');
  const container = getContainer();

  const db: any = container.get(GLOBAL_TYPES.Database);
  await db.connect();

  const entries = validateEntries(JSON.parse(readFileSync(seedFile, 'utf8')));
  console.log(`Loaded ${entries.length} case(s) from ${seedFile}`);

  const courseRepo: any = container.get(GLOBAL_TYPES.CourseRepo);
  const version = await courseRepo.readVersion(courseVersionId);
  if (!version) {
    throw new Error(`No course version found for id ${courseVersionId}`);
  }
  const courseId = version.courseId.toString();

  const service: any = container.get(CASE_STUDIES_TYPES.CaseStudyService);
  const result = await service.upsertFromSeed({
    courseId,
    courseVersionId,
    entries,
  });

  console.log(
    `Seeded course ${courseId} / version ${courseVersionId}: ${result.inserted} inserted, ${result.updated} updated.`,
  );

  await (await db.getClient()).close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
