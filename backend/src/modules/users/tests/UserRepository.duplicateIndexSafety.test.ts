import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { UserRepository } from '#shared/database/providers/mongo/repositories/UserRepository.js';

/**
 * Answers a real question before deploying the D-05 unique-index fix to a
 * database that (unlike this fork's test data) already has pre-existing
 * duplicate firebaseUID documents, like the real incident: does
 * UserRepository.init()'s un-awaited createIndex({firebaseUID:1},
 * {unique:true}) call -- which will fail against data that already
 * violates uniqueness -- crash the process (unhandled rejection), throw
 * back to the caller, or fail silently and leave existing reads/writes
 * working?
 */
describe('UserRepository unique-index creation against pre-existing duplicates', () => {
  let db: MongoDatabase;
  const sharedFirebaseUID = 'pre-existing-dup-uid-' + Date.now();
  const dupUserAId = new ObjectId();
  const dupUserBId = new ObjectId();

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'dup_index_safety_test');
    await db.connect();

    // Seed the exact pre-existing-duplicate scenario production has: two
    // user documents already sharing one firebaseUID, inserted BEFORE any
    // repository (and therefore its index-creation attempt) ever runs.
    const usersCollection = await db.getCollection('users');
    await usersCollection.insertMany([
      {
        _id: dupUserAId,
        firebaseUID: sharedFirebaseUID,
        email: 'dup-a@example.com',
        firstName: 'Dup',
        lastName: 'A',
        roles: 'user',
      },
      {
        _id: dupUserBId,
        firebaseUID: sharedFirebaseUID,
        email: 'dup-b@example.com',
        firstName: 'Dup',
        lastName: 'B',
        roles: 'user',
      },
    ] as any);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('catches the index-build failure internally instead of an unhandled rejection, and normal reads still work', async () => {
    let caughtRejection: unknown = null;
    const onUnhandledRejection = (reason: unknown) => {
      caughtRejection = reason;
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const repo = new UserRepository(db);

      // Triggers init(), which fires the un-awaited createIndex calls.
      const found = await repo.findByFirebaseUID(sharedFirebaseUID);

      // Give the background createIndex promise a tick to settle/reject.
      await new Promise(resolve => setTimeout(resolve, 200));

      // The index build genuinely fails against pre-existing duplicates
      // (E11000), but it must be caught internally by UserRepository, not
      // escape as an unhandled rejection -- that's what would crash the
      // process on a real deploy.
      expect(caughtRejection).toBeNull();

      // A normal read for an EXISTING (even duplicated) user must still work.
      expect(found).not.toBeNull();
      expect(['dup-a@example.com', 'dup-b@example.com']).toContain(
        (found as any)?.email,
      );
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });
});
