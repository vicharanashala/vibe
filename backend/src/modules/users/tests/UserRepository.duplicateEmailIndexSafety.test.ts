import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { UserRepository } from '#shared/database/providers/mongo/repositories/UserRepository.js';

/**
 * Same question as UserRepository.duplicateIndexSafety.test.ts, but for the
 * new unique index on `email` added to close the "same email, different
 * firebaseUID" race: does UserRepository.init()'s un-awaited
 * createIndex({email:1}, {unique:true}) call, which will fail against a
 * database that already has pre-existing duplicate emails, crash the
 * process, throw back to callers, or fail silently while existing reads and
 * NEW non-conflicting writes keep working?
 */
describe('UserRepository unique email-index creation against pre-existing duplicates', () => {
  let db: MongoDatabase;
  const sharedEmail = 'pre-existing-dup-email-' + Date.now() + '@example.com';
  const dupUserAId = new ObjectId();
  const dupUserBId = new ObjectId();

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'dup_email_index_safety_test');
    await db.connect();

    // Seed a pre-existing-duplicate-email scenario, inserted BEFORE any
    // repository (and therefore its index-creation attempt) ever runs.
    const usersCollection = await db.getCollection('users');
    await usersCollection.insertMany([
      {
        _id: dupUserAId,
        firebaseUID: 'dup-email-uid-a-' + Date.now(),
        email: sharedEmail,
        firstName: 'Dup',
        lastName: 'A',
        roles: 'user',
      },
      {
        _id: dupUserBId,
        firebaseUID: 'dup-email-uid-b-' + Date.now(),
        email: sharedEmail,
        firstName: 'Dup',
        lastName: 'B',
        roles: 'user',
      },
    ] as any);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('catches the email index-build failure internally instead of an unhandled rejection, and normal reads still work', async () => {
    let caughtRejection: unknown = null;
    const onUnhandledRejection = (reason: unknown) => {
      caughtRejection = reason;
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const repo = new UserRepository(db);

      const found = await repo.findByEmail(sharedEmail);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(caughtRejection).toBeNull();
      expect(found).not.toBeNull();
      expect(found?.firebaseUID).toMatch(/^dup-email-uid-[ab]-/);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('still creates a brand-new user with a genuinely unique email, even though the email index failed to build due to the pre-existing duplicates above', async () => {
    const repo = new UserRepository(db);
    const freshEmail = 'genuinely-unique-' + Date.now() + '@example.com';

    const newUserId = await repo.create({
      firebaseUID: 'fresh-uid-' + Date.now(),
      email: freshEmail,
      firstName: 'Fresh',
      lastName: 'User',
      roles: 'user',
    } as any);

    expect(newUserId).toBeTruthy();
    const found = await repo.findByEmail(freshEmail);
    expect(found).not.toBeNull();
    expect(found?._id?.toString()).toBe(newUserId);
  });
});
