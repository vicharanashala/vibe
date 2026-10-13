import {describe, it, expect, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {NotFoundError} from 'routing-controllers';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * #1383 moved the item lookup (readItemById) ahead of the heartbeat check so
 * BLOG orphans with no heartbeat can be judged by item type before being
 * rejected. Before that reordering, a no-heartbeat orphan was rejected
 * immediately and never called readItemById at all.
 *
 * readItemById throws NotFoundError (not a null return) when the item is
 * permanently deleted or missing (ItemRepository.ts: `if (!item) throw new
 * NotFoundError(...)`). recoverOrphanedWatchTimes' catch block deliberately
 * does NOT add a thrown-error record's id to rejectedIds/markRecoveryAttempted,
 * so the next sweep re-examines it -- a design meant for transient DB errors
 * ("a transient database error gets another attempt next sweep").
 *
 * A permanently deleted item is not transient: it will throw NotFoundError
 * on every future sweep too. This test checks whether that distinction is
 * made, using exactly the no-heartbeat population #1383 newly exposes to
 * this code path.
 */

const USER_ID = new ObjectId().toString();
const COURSE_ID = new ObjectId().toString();
const VERSION_ID = new ObjectId().toString();
const ITEM_ID = new ObjectId().toString();

const START = new Date('2026-08-19T10:00:00Z');

function orphan(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    userId: new ObjectId(USER_ID),
    courseId: new ObjectId(COURSE_ID),
    courseVersionId: new ObjectId(VERSION_ID),
    itemId: new ObjectId(ITEM_ID),
    startTime: START,
    lastSeenAt: undefined, // the exact BLOG-no-heartbeat case #1383 targets
    ...overrides,
  };
}

function makeService(opts: {orphans: any[]}) {
  const service: any = Object.create(ProgressService.prototype);

  const calls = {
    markedAttempted: [] as string[],
    closed: [] as any[],
  };

  service.progressRepository = {
    findOrphanedWatchTimes: async () => opts.orphans,
    closeOrphanedWatchTime: async (id: any, endTime: Date) => {
      calls.closed.push({id: id.toString(), endTime});
      return {_id: id, endTime};
    },
    markRecoveryAttempted: async (ids: any[]) => {
      calls.markedAttempted.push(...ids.map(i => i.toString()));
    },
    findProgress: async () => null,
    getHiddenOrDeletedItems: async () => [],
    getCompletedItems: async () => [],
    // Must resolve truthy -- advanceProgressAfterItemCompletion's return value
    // is `Boolean(updatedProgress)`, so an undefined stub silently makes every
    // successful advance look like it failed.
    updateProgress: async (_u: string, _c: string, _v: string, newProgress: any) =>
      newProgress,
  };

  // Mirrors ItemRepository.readItemById's real behavior for a permanently
  // deleted/missing item: throws NotFoundError, does not return null.
  service.itemRepo = {
    readItemById: async () => {
      throw new NotFoundError(`Item ${ITEM_ID} not found`);
    },
  };
  service.courseRepo = {readVersion: async () => ({_id: VERSION_ID, modules: []})};
  service.enrollmentRepo = {updateProgressPercentById: async () => undefined};
  service._withTransaction = async (fn: any) => fn({} as any);
  service.resolveEnrollment = async () => ({_id: new ObjectId()});
  service.getAllItemIds = async () => [ITEM_ID];
  service.getNextItemInSequence = async () => null;

  return {service: service as ProgressService, calls};
}

describe('ProgressService.recoverOrphanedWatchTimes -- permanently deleted item', () => {
  it('a no-heartbeat orphan whose item was permanently deleted is rejected once, not retried forever', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const record = orphan();
    const {service, calls} = makeService({orphans: [record]});

    const summary = await service.recoverOrphanedWatchTimes();

    console.log(
      `[deleted-item repro] skipped=${summary.skipped} rejected=${summary.rejected} ` +
        `markedAttempted=${JSON.stringify(calls.markedAttempted)}`,
    );

    // NotFoundError from readItemById means the item is permanently gone --
    // it will never "become found" on a later sweep, so this must be
    // rejected (and therefore marked attempted) like any other
    // permanently-unrecoverable record, not left to retry forever the way
    // a genuinely transient error should be.
    expect(summary.rejected).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(calls.markedAttempted).toEqual([record._id.toString()]);
    expect(calls.closed).toHaveLength(0);
  });

  it('mutation check: a generic (potentially transient) error is still left unmarked for retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const record = orphan();
    const {service, calls} = makeService({orphans: [record]});
    (service as any).itemRepo = {
      readItemById: async () => {
        throw new Error('connection reset');
      },
    };

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary.skipped).toBe(1);
    expect(summary.rejected).toBe(0);
    expect(calls.markedAttempted).toEqual([]);
  });

  it('a permanently deleted course version is also rejected once, not retried forever', async () => {
    // courseRepo.readVersion throws NotFoundError (not a null return) for a
    // missing version -- CourseRepository.ts: `if (courseVersion === null)
    // throw new NotFoundError(...)`. Same bug class as the deleted-item case
    // above, reached later in the same try block (after the item is found
    // and the orphan is closed, once the sweep goes looking for where to
    // advance the student's pointer to).
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const record = orphan({lastSeenAt: new Date(START.getTime() + 120_000)});
    const {service, calls} = makeService({orphans: [record]});
    (service as any).courseRepo = {
      readVersion: async () => {
        throw new NotFoundError('Course Version not found');
      },
    };
    (service as any).itemRepo = {
      readItemById: async () => ({
        _id: ITEM_ID,
        type: 'VIDEO',
        details: {startTime: '00:00:00', endTime: '00:10:00'},
      }),
    };
    // Must actually be the student's current item, or the code returns early
    // (closed-but-not-stuck) before ever reaching readVersion.
    (service as any).progressRepository.findProgress = async () => ({
      currentModule: new ObjectId().toString(),
      currentSection: new ObjectId().toString(),
      currentItem: ITEM_ID,
    });

    const summary = await service.recoverOrphanedWatchTimes();

    // The throw happens inside _withTransaction, before it returns an
    // outcome -- so neither closed nor advanced increments here, matching
    // what a real MongoDB transaction abort would also leave uncounted.
    expect(summary.closed).toBe(0);
    expect(summary.advanced).toBe(0);
    expect(summary.rejected).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(calls.markedAttempted).toEqual([record._id.toString()]);
  });

  it('a hidden BLOG item with no heartbeat is skipped, not closed -- the hidden-item check is now reachable for a population that used to be rejected before ever getting there', async () => {
    // Before #1383, a no-heartbeat orphan was rejected at the very first
    // check and never reached getHiddenOrDeletedItems at all. Now a BLOG
    // orphan with no heartbeat sails past that check, so this is the first
    // time this exact combination (BLOG + no heartbeat + hidden) exercises
    // the hidden-item branch.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const record = orphan();
    const {service, calls} = makeService({orphans: [record]});
    (service as any).itemRepo = {
      readItemById: async () => ({_id: ITEM_ID, type: 'BLOG', details: {}}),
    };
    (service as any).progressRepository.getHiddenOrDeletedItems = async () => [
      {itemId: ITEM_ID},
    ];

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary.skipped).toBe(1);
    expect(summary.rejected).toBe(0);
    expect(calls.closed).toHaveLength(0);
    expect(calls.markedAttempted).toEqual([record._id.toString()]);
  });

  it('a mixed batch keeps every outcome independent -- a deleted item and a deleted course version do not affect a genuinely recoverable BLOG row in the same sweep', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const deletedItemOrphan = orphan({itemId: new ObjectId(ITEM_ID)});

    const deletedVersionId = new ObjectId().toString();
    const deletedVersionItemId = new ObjectId().toString();
    const deletedVersionOrphan = orphan({
      _id: new ObjectId(),
      itemId: new ObjectId(deletedVersionItemId),
      courseVersionId: new ObjectId(deletedVersionId),
      lastSeenAt: new Date(START.getTime() + 120_000),
    });

    const goodItemId = new ObjectId().toString();
    const goodBlogOrphan = orphan({
      _id: new ObjectId(),
      itemId: new ObjectId(goodItemId),
    });

    const {service, calls} = makeService({
      orphans: [deletedItemOrphan, deletedVersionOrphan, goodBlogOrphan],
    });

    (service as any).itemRepo = {
      readItemById: async (id: string) => {
        if (id === ITEM_ID) throw new NotFoundError(`Item ${ITEM_ID} not found`);
        if (id === deletedVersionItemId)
          return {
            _id: deletedVersionItemId,
            type: 'VIDEO',
            details: {startTime: '00:00:00', endTime: '00:10:00'},
          };
        return {_id: goodItemId, type: 'BLOG', details: {}};
      },
    };
    (service as any).courseRepo = {
      readVersion: async (versionId: string) => {
        if (versionId === deletedVersionId) {
          throw new NotFoundError('Course Version not found');
        }
        return {_id: versionId, modules: []};
      },
    };
    (service as any).progressRepository.findProgress = async (
      _u: string,
      _c: string,
      courseVersionId: string,
    ) =>
      courseVersionId === deletedVersionId
        ? {
            currentModule: new ObjectId().toString(),
            currentSection: new ObjectId().toString(),
            currentItem: deletedVersionItemId,
          }
        : {
            currentModule: new ObjectId().toString(),
            currentSection: new ObjectId().toString(),
            currentItem: goodItemId,
          };
    (service as any).getNextItemInSequence = async () => null;

    const summary = await service.recoverOrphanedWatchTimes();

    // deletedItemOrphan: NotFoundError from readItemById -> rejected, no close.
    // deletedVersionOrphan: closes, then NotFoundError from readVersion inside
    //   the transaction -> whole transaction (including the close) rolls
    //   back -> rejected, not counted as closed.
    // goodBlogOrphan: genuinely recoverable -- must close and advance despite
    //   the other two rows in the same batch failing.
    expect(summary.scanned).toBe(3);
    expect(summary.rejected).toBe(2);
    expect(summary.skipped).toBe(0);
    // The counters, not the raw closeOrphanedWatchTime call log, are what the
    // caller actually observes -- the mock here has no real transaction
    // rollback, so closeOrphanedWatchTime's mock still records a call for
    // deletedVersionOrphan even though a real MongoDB transaction would have
    // rolled that write back when readVersion threw afterwards. summary.closed
    // is what recoverOrphanedWatchTimes reports, and it must not count that.
    expect(summary.closed).toBe(1);
    expect(summary.advanced).toBe(1);
    expect(
      calls.closed.some(c => c.id === goodBlogOrphan._id.toString()),
    ).toBe(true);
    expect(calls.markedAttempted.sort()).toEqual(
      [deletedItemOrphan._id.toString(), deletedVersionOrphan._id.toString()].sort(),
    );
  });
});
