import {MongoClient, ObjectId} from 'mongodb';
import {dbConfig} from '#root/config/db.js';
import {
  CrowdValidationState,
  ICrowdValidationMetrics,
  StudentQuestionStatus,
} from './classes/transformers/StudentSegmentQuestion.js';

type StudentQuestionMigrationDoc = {
  _id: ObjectId;
  status?: StudentQuestionStatus;
  crowdValidationState?: CrowdValidationState;
  crowdValidationMetrics?: ICrowdValidationMetrics;
};

type MigrationOptions = {
  dryRun?: boolean;
  batchSize?: number;
  mongoUri?: string;
  dbName?: string;
  collectionName?: string;
};

type MigrationResult = {
  scanned: number;
  changed: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
};

type MigrationPatch = {
  $set: Partial<{
    crowdValidationState: CrowdValidationState;
    crowdValidationMetrics: ICrowdValidationMetrics;
    updatedAt: Date;
  }>;
};

const DEFAULT_METRICS: ICrowdValidationMetrics = {
  totalAttempts: 0,
  correctAttempts: 0,
};

export function mapStatusToCrowdValidationState(
  status?: StudentQuestionStatus,
): CrowdValidationState {
  if (status === 'VALIDATED') {
    return 'KEPT';
  }

  if (status === 'REJECTED') {
    return 'DISCARDED';
  }

  if (status === 'TO_BE_VALIDATED') {
    return 'READY_FOR_CROWD';
  }

  return 'PENDING_CROWD_DATA';
}

function toNonNegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return value;
}

function hasValidMetrics(metrics?: ICrowdValidationMetrics): boolean {
  if (!metrics) {
    return false;
  }

  if (typeof metrics.totalAttempts !== 'number') {
    return false;
  }

  if (typeof metrics.correctAttempts !== 'number') {
    return false;
  }

  if (metrics.totalAttempts < 0 || metrics.correctAttempts < 0) {
    return false;
  }

  if (metrics.correctAttempts > metrics.totalAttempts) {
    return false;
  }

  return true;
}

export function buildCrowdValidationPatch(
  document: StudentQuestionMigrationDoc,
): MigrationPatch | null {
  const nextState =
    document.crowdValidationState ?? mapStatusToCrowdValidationState(document.status);

  const existingMetrics = document.crowdValidationMetrics;
  const nextMetrics = hasValidMetrics(existingMetrics)
    ? {
        totalAttempts: toNonNegativeNumber(existingMetrics?.totalAttempts),
        correctAttempts: toNonNegativeNumber(existingMetrics?.correctAttempts),
        ...(existingMetrics && typeof existingMetrics.correctRate === 'number'
          ? {correctRate: existingMetrics.correctRate}
          : {}),
      }
    : {...DEFAULT_METRICS};

  const rate =
    nextMetrics.totalAttempts > 0
      ? nextMetrics.correctAttempts / nextMetrics.totalAttempts
      : undefined;

  const normalizedMetrics = {
    ...nextMetrics,
    ...(typeof rate === 'number' ? {correctRate: rate} : {}),
  };

  const isStateSame = document.crowdValidationState === nextState;
  const isMetricsSame =
    document.crowdValidationMetrics?.totalAttempts === normalizedMetrics.totalAttempts &&
    document.crowdValidationMetrics?.correctAttempts === normalizedMetrics.correctAttempts &&
    document.crowdValidationMetrics?.correctRate === normalizedMetrics.correctRate;

  if (isStateSame && isMetricsSame) {
    return null;
  }

  return {
    $set: {
      crowdValidationState: nextState,
      crowdValidationMetrics: normalizedMetrics,
      updatedAt: new Date(),
    },
  };
}

export async function migrateStudentQuestionMetadata(
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const dryRun = options.dryRun ?? true;
  const batchSize = options.batchSize ?? 500;
  const mongoUri = options.mongoUri ?? dbConfig.url;
  const dbName = options.dbName ?? dbConfig.dbName;
  const collectionName = options.collectionName ?? 'student_segment_questions';

  if (!mongoUri) {
    throw new Error('DB_URL is required to run student question migration.');
  }

  const client = new MongoClient(mongoUri, {
    maxPoolSize: 10,
    connectTimeoutMS: 20_000,
  });

  const result: MigrationResult = {
    scanned: 0,
    changed: 0,
    skipped: 0,
    failed: 0,
    dryRun,
  };

  try {
    await client.connect();

    const collection = client
      .db(dbName)
      .collection<StudentQuestionMigrationDoc>(collectionName);

    const query = {
      $or: [
        {crowdValidationState: {$exists: false}},
        {crowdValidationMetrics: {$exists: false}},
        {'crowdValidationMetrics.totalAttempts': {$exists: false}},
        {'crowdValidationMetrics.correctAttempts': {$exists: false}},
      ],
    };

    const cursor = collection.find(query, {batchSize});
    const updates: Array<{_id: ObjectId; patch: MigrationPatch}> = [];

    for await (const doc of cursor) {
      result.scanned += 1;

      const patch = buildCrowdValidationPatch(doc);
      if (!patch) {
        result.skipped += 1;
        continue;
      }

      updates.push({_id: doc._id, patch});
    }

    if (dryRun) {
      result.changed = updates.length;
      return result;
    }

    if (updates.length === 0) {
      return result;
    }

    for (let index = 0; index < updates.length; index += batchSize) {
      const slice = updates.slice(index, index + batchSize);
      const operations = slice.map(update => ({
        updateOne: {
          filter: {_id: update._id},
          update: update.patch,
        },
      }));

      const response = await collection.bulkWrite(operations, {ordered: false});
      result.changed += response.modifiedCount;
    }

    return result;
  } catch (error) {
    result.failed += 1;
    throw error;
  } finally {
    await client.close();
  }
}

function parseArgs(argv: string[]) {
  const execute = argv.includes('--execute');
  const dryRun = !execute;

  const batchArg = argv.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchArg ? Number(batchArg.split('=')[1]) : undefined;

  return {
    dryRun,
    batchSize:
      typeof batchSize === 'number' && Number.isInteger(batchSize) && batchSize > 0
        ? batchSize
        : undefined,
  };
}

async function runFromCli() {
  const options = parseArgs(process.argv.slice(2));

  const summary = await migrateStudentQuestionMetadata(options);

  console.log('[StudentQuestionMigration] complete');
  console.log(`dryRun=${summary.dryRun}`);
  console.log(`scanned=${summary.scanned}`);
  console.log(`changed=${summary.changed}`);
  console.log(`skipped=${summary.skipped}`);
  console.log(`failed=${summary.failed}`);

  if (summary.dryRun) {
    console.log('Run with --execute to apply updates.');
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('/StudentQuestionMigration.js') ||
    process.argv[1].endsWith('/StudentQuestionMigration.ts'));

if (isDirectRun) {
  runFromCli().catch(error => {
    console.error('[StudentQuestionMigration] failed');
    console.error(error);
    process.exitCode = 1;
  });
}
