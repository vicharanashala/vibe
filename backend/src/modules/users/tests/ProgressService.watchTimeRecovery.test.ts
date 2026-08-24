import {describe, it, expect, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Unit tests for the orphaned watch-time recovery sweep.
 *
 * DI is bypassed the same way ProgressService.leaderboard.test.ts does it: the
 * prototype is instantiated directly and only the collaborators the method
 * touches are stubbed. isValidWatchTime is deliberately left real — the whole
 * point of the job is that it enforces the same watch-duration bar as the live
 * stop path, so stubbing it would test nothing.
 */

const USER_ID = new ObjectId().toString();
const COURSE_ID = new ObjectId().toString();
const VERSION_ID = new ObjectId().toString();
const ITEM_ID = new ObjectId().toString();
const NEXT_ITEM_ID = new ObjectId().toString();
const MODULE_ID = new ObjectId().toString();
const SECTION_ID = new ObjectId().toString();

// 10-minute video: minimum required watch time is min(600 * 0.15, 30) = 30s.
const VIDEO_ITEM = {
  _id: ITEM_ID,
  type: 'VIDEO',
  details: {startTime: '00:00:00', endTime: '00:10:00'},
};

const START = new Date('2026-08-19T10:00:00Z');
const secondsAfterStart = (n: number) =>
  new Date(START.getTime() + n * 1000);

function orphan(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    userId: new ObjectId(USER_ID),
    courseId: new ObjectId(COURSE_ID),
    courseVersionId: new ObjectId(VERSION_ID),
    itemId: new ObjectId(ITEM_ID),
    startTime: START,
    lastSeenAt: secondsAfterStart(120),
    ...overrides,
  };
}

function makeService(opts: {
  orphans: any[];
  item?: any;
  progress?: any;
  closeReturns?: (orphanId: any) => any;
}) {
  const service: any = Object.create(ProgressService.prototype);

  const calls = {
    closed: [] as {id: string; endTime: Date}[],
    markedAttempted: [] as string[],
    progressUpdates: [] as any[],
    enrollmentUpdates: [] as any[],
  };

  service.progressRepository = {
    findOrphanedWatchTimes: async () => opts.orphans,
    closeOrphanedWatchTime: async (id: any, endTime: Date) => {
      const result = opts.closeReturns
        ? opts.closeReturns(id)
        : {_id: id, endTime};
      if (result) calls.closed.push({id: id.toString(), endTime});
      return result;
    },
    markRecoveryAttempted: async (ids: any[]) => {
      calls.markedAttempted.push(...ids.map(i => i.toString()));
    },
    findProgress: async () =>
      opts.progress === undefined
        ? {
            currentModule: MODULE_ID,
            currentSection: SECTION_ID,
            currentItem: ITEM_ID,
          }
        : opts.progress,
    getHiddenOrDeletedItems: async () => [],
    getCompletedItems: async () => [],
    updateProgress: async (
      _u: string,
      _c: string,
      _v: string,
      newProgress: any,
    ) => {
      calls.progressUpdates.push(newProgress);
      return newProgress;
    },
  };

  service.itemRepo = {
    readItemById: async () =>
      opts.item === undefined ? VIDEO_ITEM : opts.item,
  };
  service.courseRepo = {
    readVersion: async () => ({_id: VERSION_ID, modules: []}),
  };
  service.enrollmentRepo = {
    updateProgressPercentById: async (...args: any[]) => {
      calls.enrollmentUpdates.push(args);
    },
  };

  // Collaborators of the advance path that have their own coverage elsewhere.
  service._withTransaction = async (fn: any) => fn({} as any);
  service.resolveEnrollment = async () => ({_id: new ObjectId()});
  service.getAllItemIds = async () => [ITEM_ID, NEXT_ITEM_ID];
  service.getNextItemInSequence = async () => ({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: NEXT_ITEM_ID,
    completed: false,
  });

  return {service: service as ProgressService, calls};
}

describe('ProgressService.recoverOrphanedWatchTimes', () => {
  it('closes a genuinely watched session and advances the stuck pointer', async () => {
    const record = orphan();
    const {service, calls} = makeService({orphans: [record]});

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary).toMatchObject({
      scanned: 1,
      closed: 1,
      advanced: 1,
      rejected: 0,
    });
    // Closed at the heartbeat, not at "now" — the student stopped watching then.
    expect(calls.closed[0].endTime).toEqual(record.lastSeenAt);
    expect(calls.progressUpdates[0]).toMatchObject({
      completed: false,
      currentItem: NEXT_ITEM_ID,
    });
  });

  it('leaves a session that fails the watch-duration bar incomplete', async () => {
    // 5 seconds watched of a 10-minute video: nowhere near the 30s minimum.
    const record = orphan({lastSeenAt: secondsAfterStart(5)});
    const {service, calls} = makeService({orphans: [record]});

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary).toMatchObject({scanned: 1, closed: 0, advanced: 0, rejected: 1});
    expect(calls.closed).toHaveLength(0);
    expect(calls.progressUpdates).toHaveLength(0);
    // Marked so the next sweep does not re-examine a record that can never pass.
    expect(calls.markedAttempted).toEqual([record._id.toString()]);
  });

  it('skips a session with no heartbeat, since nothing evidences time spent', async () => {
    const record = orphan({lastSeenAt: undefined});
    const {service, calls} = makeService({orphans: [record]});

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary).toMatchObject({scanned: 1, closed: 0, skipped: 1});
    expect(calls.closed).toHaveLength(0);
    expect(calls.markedAttempted).toEqual([record._id.toString()]);
  });

  it('never fabricates completion for submission-based items', async () => {
    const {service, calls} = makeService({
      orphans: [orphan()],
      item: {_id: ITEM_ID, type: 'QUIZ', details: {}},
    });

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary).toMatchObject({scanned: 1, closed: 0, advanced: 0, skipped: 1});
    expect(calls.progressUpdates).toHaveLength(0);
  });

  it('closes the record but leaves the pointer alone when it has already moved on', async () => {
    const {service, calls} = makeService({
      orphans: [orphan()],
      progress: {
        currentModule: MODULE_ID,
        currentSection: SECTION_ID,
        currentItem: NEXT_ITEM_ID,
      },
    });

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary).toMatchObject({scanned: 1, closed: 1, advanced: 0});
    expect(calls.progressUpdates).toHaveLength(0);
  });

  it('does not advance twice when another instance closed the record first', async () => {
    const {service, calls} = makeService({
      orphans: [orphan()],
      closeReturns: () => null,
    });

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary).toMatchObject({scanned: 1, closed: 0, advanced: 0});
    expect(calls.progressUpdates).toHaveLength(0);
  });

  it('keeps sweeping after one record throws', async () => {
    const bad = orphan();
    const good = orphan();
    const {service, calls} = makeService({orphans: [bad, good]});
    const readItemById = vi
      .fn()
      .mockRejectedValueOnce(new Error('item lookup blew up'))
      .mockResolvedValue(VIDEO_ITEM);
    (service as any).itemRepo = {readItemById};
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const summary = await service.recoverOrphanedWatchTimes();

    expect(summary).toMatchObject({scanned: 2, closed: 1, advanced: 1, skipped: 1});
    expect(calls.closed[0].id).toBe(good._id.toString());
  });
});
