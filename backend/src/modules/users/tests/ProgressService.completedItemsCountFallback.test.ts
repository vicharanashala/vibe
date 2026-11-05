import {describe, it, expect, vi} from 'vitest';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Regression test: updateEnrollmentProgressPercent computed percentCompleted
 * from `completedItemCount || completedItems` (falling back to the freshly
 * recounted value when the caller didn't pass an explicit count -- the
 * common case), but wrote the enrollment's completedItemsCount field from
 * the bare `completedItemCount` parameter with no such fallback. On the
 * common call path that parameter is undefined, which
 * EnrollmentRepository.updateProgressPercentById's `typeof === 'number'`
 * guard silently treats as "don't touch this field" -- so percentCompleted
 * updated correctly while completedItemsCount stayed frozen at whatever it
 * was last explicitly set to, drifting the two fields apart (confirmed live:
 * an enrollment showing percentCompleted 98.89% -- the correct value for
 * 89/90 -- alongside a stale completedItemsCount of 90).
 *
 * DI is bypassed the same way the other ProgressService unit tests in this
 * module do it: the prototype is instantiated directly and only the
 * collaborators this call path touches are stubbed.
 */

const USER_ID = 'user-1';
const COURSE_ID = 'course-1';
const VERSION_ID = 'version-1';
const ENROLLMENT_ID = 'enrollment-1';

function makeService(completedItemIds: string[]) {
  const service: any = Object.create(ProgressService.prototype);

  service.userRepo = {
    findById: async () => ({_id: USER_ID}),
  };
  service.courseRepo = {
    read: async () => ({_id: COURSE_ID}),
    readVersion: async () => ({_id: VERSION_ID, courseId: COURSE_ID}),
  };
  service._withTransaction = async (fn: any) => fn({} as any);

  const updateProgressPercentById = vi.fn().mockResolvedValue(undefined);

  service.enrollmentRepo = {
    findEnrollment: async () => ({
      _id: ENROLLMENT_ID,
      userId: USER_ID,
      courseId: COURSE_ID,
      courseVersionId: VERSION_ID,
    }),
    updateProgressPercentById,
  };

  service.progressRepository = {
    getCompletedItems: async () => completedItemIds,
  };

  return {service: service as ProgressService, updateProgressPercentById};
}

describe('ProgressService.updateEnrollmentProgressPercent -- completedItemsCount fallback', () => {
  it('writes the freshly-recounted completedItemsCount, not undefined, when the caller omits it', async () => {
    // 90 total items, 89 genuinely completed -- matches the live
    // discrepancy this test guards against (percentCompleted 98.89%).
    const completedItemIds = Array.from({length: 89}, (_, i) => `item-${i}`);
    const {service, updateProgressPercentById} = makeService(completedItemIds);

    await service.updateEnrollmentProgressPercent(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      undefined, // session
      false, // isReset
      90, // totalItemCount
      undefined, // completedItemCount -- the common call path: caller doesn't pre-compute it
      undefined, // cohort
    );

    expect(updateProgressPercentById).toHaveBeenCalledTimes(1);
    const [, percentCompleted, completedItemsCountArg] =
      updateProgressPercentById.mock.calls[0];

    expect(percentCompleted).toBe(98.89);
    // The bug: this used to be `undefined`, silently leaving the stored
    // completedItemsCount field untouched instead of syncing it to the 89
    // that percentCompleted was actually computed from.
    expect(completedItemsCountArg).toBe(89);
  });

  it('still honors an explicitly-passed completedItemCount (e.g. a caller with its own precomputed count)', async () => {
    const {service, updateProgressPercentById} = makeService(
      Array.from({length: 89}, (_, i) => `item-${i}`),
    );

    await service.updateEnrollmentProgressPercent(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      undefined,
      false,
      90,
      42, // explicit completedItemCount -- should win over the recount
      undefined,
    );

    const [, percentCompleted, completedItemsCountArg] =
      updateProgressPercentById.mock.calls[0];
    expect(completedItemsCountArg).toBe(42);
    expect(percentCompleted).toBe(46.67);
  });

  it('passes the raw completedItemCount through unchanged on isReset (no recount should run)', async () => {
    const {service, updateProgressPercentById} = makeService([]);

    await service.updateEnrollmentProgressPercent(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      undefined,
      true, // isReset
      undefined,
      0, // resetCourseProgress's own caller passes 0 explicitly
      undefined,
    );

    const [, percentCompleted, completedItemsCountArg] =
      updateProgressPercentById.mock.calls[0];
    expect(percentCompleted).toBe(0);
    expect(completedItemsCountArg).toBe(0);
  });
});
