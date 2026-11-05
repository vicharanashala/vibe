import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { ProgressRepository } from '#shared/database/providers/mongo/repositories/ProgressRepository.js';

/**
 * Reproduces the mechanism behind D-06 (SASTRA incident report): inside
 * ProgressService.stopItem's transaction, recalculateStudentProgress is
 * called WITHOUT the transaction's session (ProgressService.ts:2681-2688),
 * right after a correct, session-aware percentCompleted write (step 10,
 * ~2666). recalculateStudentProgress's own reads (ProgressRepository
 * .getCompletedItems, called without session) then compute a fresh
 * percentCompleted and unconditionally overwrite that correct value --
 * using data read from OUTSIDE the still-open transaction.
 *
 * This test isolates that exact mechanism with the real repository code:
 * does an un-sessioned read see a write made moments earlier inside a
 * still-open (uncommitted) transaction on the same document? MongoDB's
 * transaction isolation is a hard guarantee, not a timing-dependent race
 * like the D-05 duplicate-account bug -- so this is deterministic, not
 * probabilistic.
 */
describe('Un-sessioned read cannot see an open transaction\'s own write (D-06 mechanism)', () => {
  let db: MongoDatabase;
  let progressRepo: ProgressRepository;

  const userId = new ObjectId();
  const courseId = new ObjectId();
  const courseVersionId = new ObjectId();
  const itemId = new ObjectId();
  const watchTimeId = new ObjectId();

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'stale_read_test');
    await db.connect();
    progressRepo = new ProgressRepository(db);

    const watchTimeCollection = await db.getCollection('watchTime');
    await watchTimeCollection.insertOne({
      _id: watchTimeId,
      userId,
      courseId,
      courseVersionId,
      itemId,
      startTime: new Date(),
      // No endTime yet -- this is the "student is about to finish their
      // last item" state, right before stopItem's transaction runs.
      isDeleted: false,
    } as any);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('getCompletedItems (no session) does not see stopItemTracking\'s write from a still-open transaction', async () => {
    const client = await db.getClient();
    const session = client.startSession();
    session.startTransaction();

    try {
      // Mirrors stopItem step 1: close the watchTime row inside the
      // transaction (this is what makes the item "completed").
      const stopped = await progressRepo.stopItemTracking(
        watchTimeId.toString(),
        session,
      );
      expect(stopped).not.toBeNull();

      // Mirrors recalculateStudentProgress's un-sessioned read, called
      // moments later from inside the SAME still-open transaction.
      const completedItemsSeenWithoutSession = await progressRepo.getCompletedItems(
        userId.toString(),
        courseId.toString(),
        courseVersionId.toString(),
      );

      // For comparison: the same read, done correctly WITH the session --
      // this is what step 10 (percentCompleted, ~ProgressService.ts:2633)
      // does, and it DOES see the item as completed.
      const completedItemsSeenWithSession = await progressRepo.getCompletedItems(
        userId.toString(),
        courseId.toString(),
        courseVersionId.toString(),
        undefined,
        session,
      );

      console.log(
        `[D-06 repro] completed items visible WITHOUT session: ${completedItemsSeenWithoutSession.length}, ` +
          `WITH session: ${completedItemsSeenWithSession.length}`,
      );

      await session.commitTransaction();

      // The bug: recalculateStudentProgress's un-sessioned read misses the
      // item that was JUST completed inside the still-open transaction --
      // so a recalculation triggered at >99% completion computes stale,
      // too-low numbers and unconditionally overwrites the correct value
      // step 10 had just written.
      expect(completedItemsSeenWithoutSession).toHaveLength(0);
      expect(completedItemsSeenWithSession).toHaveLength(1);
    } finally {
      if (session.inTransaction()) await session.abortTransaction();
      await session.endSession();
    }
  });
});
