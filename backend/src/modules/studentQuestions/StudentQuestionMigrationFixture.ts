import assert from 'node:assert/strict';
import {MongoClient, ObjectId} from 'mongodb';
import {dbConfig} from '#root/config/db.js';
import {migrateStudentQuestionMetadata} from './StudentQuestionMigration.js';

const COLLECTION_NAME = 'student_segment_questions';

function buildTempDbName(): string {
  const base = (dbConfig.dbName || 'vibe').slice(0, 12);
  const suffix = Date.now().toString(36);
  return `${base}_sqmig_${suffix}`;
}

async function seedFixtureDocs(mongoUri: string, dbName: string): Promise<void> {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const collection = client.db(dbName).collection(COLLECTION_NAME);

    await collection.insertMany([
      {
        _id: new ObjectId(),
        status: 'UNVERIFIED',
        questionText: 'Fixture A',
      },
      {
        _id: new ObjectId(),
        status: 'VALIDATED',
        questionText: 'Fixture B',
      },
      {
        _id: new ObjectId(),
        status: 'TO_BE_VALIDATED',
        crowdValidationState: 'READY_FOR_CROWD',
        questionText: 'Fixture C',
      },
      {
        _id: new ObjectId(),
        status: 'REJECTED',
        crowdValidationState: 'DISCARDED',
        crowdValidationMetrics: {
          totalAttempts: 4,
          correctAttempts: 1,
          correctRate: 0.25,
        },
        questionText: 'Fixture D',
      },
    ]);
  } finally {
    await client.close();
  }
}

async function cleanupDb(mongoUri: string, dbName: string): Promise<void> {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    try {
      await client.db(dbName).dropDatabase();
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown cleanup failure';

      if (!message.includes('dropDatabase')) {
        throw error;
      }

      await client
        .db(dbName)
        .collection(COLLECTION_NAME)
        .deleteMany({questionText: {$regex: /^Fixture /}});

      console.log(
        '[StudentQuestionMigrationFixture] dropDatabase not permitted, cleaned fixture documents instead',
      );
    }
  } finally {
    await client.close();
  }
}

async function runFixture() {
  const keepDb = process.argv.includes('--keep-db');
  const mongoUri = dbConfig.url;

  if (!mongoUri) {
    throw new Error('DB_URL is required for fixture test.');
  }

  const tempDbName = buildTempDbName();

  console.log('[StudentQuestionMigrationFixture] setup');
  console.log(`dbName=${tempDbName}`);

  await seedFixtureDocs(mongoUri, tempDbName);

  const firstDryRun = await migrateStudentQuestionMetadata({
    dryRun: true,
    dbName: tempDbName,
    mongoUri,
    collectionName: COLLECTION_NAME,
  });

  console.log('[StudentQuestionMigrationFixture] first dry run', firstDryRun);

  assert.equal(firstDryRun.scanned, 3, 'Expected first dry run scanned=3');
  assert.equal(firstDryRun.changed, 3, 'Expected first dry run changed=3');
  assert.equal(firstDryRun.skipped, 0, 'Expected first dry run skipped=0');
  assert.equal(firstDryRun.failed, 0, 'Expected first dry run failed=0');

  const executeRun = await migrateStudentQuestionMetadata({
    dryRun: false,
    dbName: tempDbName,
    mongoUri,
    collectionName: COLLECTION_NAME,
  });

  console.log('[StudentQuestionMigrationFixture] execute run', executeRun);

  assert.equal(executeRun.scanned, 3, 'Expected execute run scanned=3');
  assert.equal(executeRun.changed, 3, 'Expected execute run changed=3');
  assert.equal(executeRun.failed, 0, 'Expected execute run failed=0');

  const secondDryRun = await migrateStudentQuestionMetadata({
    dryRun: true,
    dbName: tempDbName,
    mongoUri,
    collectionName: COLLECTION_NAME,
  });

  console.log('[StudentQuestionMigrationFixture] second dry run', secondDryRun);

  assert.equal(secondDryRun.scanned, 0, 'Expected second dry run scanned=0');
  assert.equal(secondDryRun.changed, 0, 'Expected second dry run changed=0');
  assert.equal(secondDryRun.skipped, 0, 'Expected second dry run skipped=0');
  assert.equal(secondDryRun.failed, 0, 'Expected second dry run failed=0');

  console.log('[StudentQuestionMigrationFixture] success');

  if (keepDb) {
    console.log('[StudentQuestionMigrationFixture] keeping temp database for inspection');
    return;
  }

  await cleanupDb(mongoUri, tempDbName);
  console.log('[StudentQuestionMigrationFixture] cleaned up temp database');
}

runFixture().catch(error => {
  console.error('[StudentQuestionMigrationFixture] failed');
  console.error(error);
  process.exitCode = 1;
});
