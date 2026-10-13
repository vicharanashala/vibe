import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * The PR's own recalculateProgressNonFatal.test.ts stubs
 * recalculateStudentProgress to reject with a plain application-level
 * NotFoundError -- a pure JS throw that never touched the real MongoDB
 * transaction at all. That's the ONE failure mode the try/catch was
 * written for, and it's genuinely safe to swallow.
 *
 * This test drives the SAME real stopItem code path (real BaseService
 * _withTransaction, a real MongoDB session, real step-11 write
 * afterwards) but makes recalculateStudentProgress fail with a GENUINE
 * MongoDB-level error instead -- plausible now that #1380 threads the
 * session through recalculateStudentProgress's own internal writes too,
 * so a real write conflict/duplicate-key/etc. from THOSE writes is a real
 * possibility, not a contrived one.
 *
 * The question: does stopItem's bare `catch (err)` actually make this
 * failure non-fatal, the way the PR claims, once the failure is a real
 * DB-level error rather than a validation throw?
 */

const USER_ID = 'user-1';
const COURSE_ID = 'course-1';
const VERSION_ID = 'version-1';
const ITEM_ID = 'item-1';
const MODULE_ID = 'module-1';
const SECTION_ID = 'section-1';
const WATCH_ITEM_ID = 'watchtime-1';

describe('stopItem non-fatal recalculation vs. a genuine MongoDB-level error', () => {
  let db: MongoDatabase;

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'broad_catch_test_' + Date.now());
    await db.connect();
    const conflictColl = await db.getCollection('conflictProbe');
    await conflictColl.createIndex({uniqueKey: 1}, {unique: true});
    await conflictColl.insertOne({uniqueKey: 'already-taken'} as any);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  function makeService() {
    const service: any = Object.create(ProgressService.prototype);
    // Real BaseService.db, so the REAL (unstubbed) _withTransaction opens a
    // genuine MongoDB session/transaction, exactly like production.
    service.db = db;

    service.courseRepo = {
      readVersion: async () => ({_id: VERSION_ID, courseId: COURSE_ID, modules: []}),
      getCourseVersionStatus: async () => 'active',
    };
    service.itemRepo = {
      readItemById: async () => ({
        _id: ITEM_ID,
        type: 'VIDEO',
        details: {startTime: '00:00:00', endTime: '00:10:00'},
      }),
    };
    service.getCourseSettingService = () => ({
      isLinearProgressionEnabled: async () => false,
      readCourseSettings: async () => ({settings: {followUpInvite: {enabled: false}}}),
    });
    service.progressRepository = {
      findProgress: async () => ({
        completed: false,
        currentModule: MODULE_ID,
        currentSection: SECTION_ID,
        currentItem: ITEM_ID,
      }),
      stopItemTracking: async () => ({
        _id: WATCH_ITEM_ID,
        startTime: new Date('2026-08-19T10:00:00Z'),
        endTime: new Date('2026-08-19T10:11:00Z'),
      }),
      getCompletedItems: async () => [ITEM_ID],
      getHiddenOrDeletedItems: async () => [],
      isItemCompleted: async () => false,
      // The REAL step-11 write. Genuinely uses the passed-in session, like
      // production. If the session/transaction is dead by the time this
      // runs, this call is expected to surface that.
      updateProgress: async (
        _userId: string,
        _courseId: string,
        _versionId: string,
        _newProgress: any,
        _cohortId: string | undefined,
        session: any,
      ) => {
        const coll = await db.getCollection('progressProbe');
        await coll.updateOne(
          {userId: USER_ID},
          {$set: {touched: true}},
          {upsert: true, session},
        );
        return {completed: true};
      },
    };
    service.validateItemStopEligibility = async () => undefined;
    service.getNextItemInSequence = async () => null;
    service.getAllItemIds = async () => [ITEM_ID];
    service.enrollmentRepo = {
      findEnrollment: async () => ({
        _id: 'enrollment-1',
        userId: USER_ID,
        courseId: COURSE_ID,
        courseVersionId: VERSION_ID,
        percentCompleted: 0,
      }),
      // The REAL step-10 write this fix exists to protect.
      updateProgressPercentById: async (
        _enrollmentId: string,
        _percent: number,
        _count: number,
        _cohortId: string | undefined,
        session: any,
      ) => {
        const coll = await db.getCollection('enrollmentProbe');
        await coll.updateOne(
          {userId: USER_ID},
          {$set: {touched: true}},
          {upsert: true, session},
        );
      },
    };

    // recalculateStudentProgress fails with a GENUINE MongoDB-level error
    // (E11000 on a real unique index), using the SAME real session
    // stopItem's transaction passes it -- mirroring what could happen if
    // one of recalculateStudentProgress's own now-session-threaded writes
    // (enrollmentRepo.updateProgressPercentById, addBulkWatchTime, etc.)
    // hits a real conflict in production.
    service.recalculateStudentProgress = async (
      _userId: string,
      _courseId: string,
      _versionId: string,
      _cohortId: string | undefined,
      session: any,
    ) => {
      const conflictColl = await db.getCollection('conflictProbe');
      await conflictColl.insertOne({uniqueKey: 'already-taken'} as any, {session});
    };

    return service as ProgressService;
  }

  it('a genuine MongoDB-level error from recalculateStudentProgress propagates cleanly (not swallowed, not masked by a retry-storm)', async () => {
    const service = makeService();

    let stopItemError: any = null;
    try {
      await (service as any).stopItem(
        USER_ID,
        COURSE_ID,
        VERSION_ID,
        ITEM_ID,
        SECTION_ID,
        MODULE_ID,
        WATCH_ITEM_ID,
      );
    } catch (err) {
      stopItemError = err;
    }

    const enrollmentProbe = await db.getCollection('enrollmentProbe');
    const progressProbe = await db.getCollection('progressProbe');
    const step10Persisted = await enrollmentProbe.findOne({userId: USER_ID});
    const step11Persisted = await progressProbe.findOne({userId: USER_ID});

    console.log(
      `[broad-catch repro] stopItem ${stopItemError ? 'THREW: ' + (stopItemError.codeName || stopItemError.name || stopItemError.message) : 'resolved'}, ` +
        `step10 (the write this PR protects) persisted: ${!!step10Persisted}, ` +
        `step11 persisted: ${!!step11Persisted}`,
    );

    // Confirmed live (see PR review) that with the original bare
    // `catch (err)`, this scenario is genuinely worse than doing nothing:
    // recalculateStudentProgress's own write hits E11000, the try/catch
    // swallows it, but MongoDB has already marked the transaction dead
    // server-side regardless of the swallowed JS exception. The very next
    // operation (step 11, the actual completion write) then throws
    // NoSuchTransaction. _withTransaction treats that as transient and
    // retries the WHOLE operation up to MAX_RETRIES times -- but the retry
    // hits the identical E11000 every time (this conflict is deterministic,
    // not a one-off race), so all 3 attempts fail identically and stopItem
    // surfaces a confusing NoSuchTransaction instead of either a clean
    // completion or the original, informative error. A stale step-10 write
    // was also observed to survive despite every attempt nominally
    // aborting, on top of step 11 (the real completion record) never
    // landing -- a worse outcome than the pre-#1402 code, which surfaced
    // the original error immediately on a single attempt with no stale
    // partial write.
    //
    // With the narrowed catch (only swallowing NotFoundError/BadRequestError,
    // recalculateStudentProgress's own deliberate pre-write validation
    // throws), a genuine MongoDB-level error is left to propagate normally:
    // one attempt, the original error, not the confusing retry-storm above.
    expect(stopItemError).not.toBeNull();
    expect(stopItemError.code).toBe(11000);
    expect(step11Persisted).toBeNull();
  });
});
