import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * Ephemeral, in-process MongoDB for the test suite — replaces the external
 * Atlas cluster + per-run IP allowlisting previously used in CI. Runs as a
 * single-node replica set (not a plain standalone) because the app relies on
 * multi-document transactions, which standalone MongoDB doesn't support.
 *
 * Needs no secrets/credentials, so it works identically for same-repo and
 * fork PRs — unlike the Atlas-backed setup it replaces.
 */
let replSet: MongoMemoryReplSet;

export async function setup() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DB_URL = replSet.getUri();
}

export async function teardown() {
  await replSet.stop();
}
