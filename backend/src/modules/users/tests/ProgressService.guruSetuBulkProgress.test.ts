import {describe, it, expect, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Regression test for the Guru Setu branch of
 * updateEnrollmentProgressPercentBulk.
 *
 * Creating or deleting an item recomputes progress for every enrollment in
 * the course version. For Guru Setu that used to re-run the full feedback
 * calculation (a version-wide scan plus a submissions query) once per
 * enrollment, concurrently — with a large FDP cohort the request outlived the
 * proxy timeout and the browser reported a CORS error. The bulk path must now
 * hit the repositories a constant number of times regardless of cohort size.
 */

const GURU_SETU_COURSE_ID = '6981df886e100cfe04f9c4ad';
const GURU_SETU_VERSION_ID = '6981df886e100cfe04f9c4ae';

const FORM_A = new ObjectId();
const FORM_B = new ObjectId();

function makeService(enrollmentCount: number) {
  const service: any = Object.create(ProgressService.prototype);

  const userIds = Array.from({length: enrollmentCount}, () => new ObjectId());

  const getFeedbackItems = vi.fn().mockResolvedValue([
    {_id: FORM_A},
    {_id: FORM_B},
  ]);
  const getAllByVersionId = vi.fn().mockResolvedValue([
    // user 0 submitted both forms, user 1 submitted one, the rest none
    {userId: userIds[0], feedbackFormId: FORM_A},
    {userId: userIds[0], feedbackFormId: FORM_B},
    {userId: userIds[1], feedbackFormId: FORM_A},
  ]);
  const getAllByUserAndVersionId = vi.fn().mockResolvedValue([]);
  const bulkUpdateEnrollments = vi.fn().mockResolvedValue({ok: 1});

  service.itemRepo = {getFeedbackItems};
  service.feedbackRepository = {getAllByVersionId, getAllByUserAndVersionId};
  service.enrollmentRepo = {bulkUpdateEnrollments};

  const enrollments = userIds.map(userId => ({
    userId,
    completedItemsCount: 0,
  }));

  return {
    service,
    enrollments,
    userIds,
    getFeedbackItems,
    getAllByVersionId,
    getAllByUserAndVersionId,
    bulkUpdateEnrollments,
  };
}

describe('ProgressService.updateEnrollmentProgressPercentBulk (Guru Setu)', () => {
  it('queries feedback items and submissions once, not once per enrollment', async () => {
    const {
      service,
      enrollments,
      getFeedbackItems,
      getAllByVersionId,
      getAllByUserAndVersionId,
    } = makeService(500);

    await service.updateEnrollmentProgressPercentBulk(
      enrollments,
      GURU_SETU_COURSE_ID,
      GURU_SETU_VERSION_ID,
      10,
    );

    expect(getFeedbackItems).toHaveBeenCalledTimes(1);
    expect(getAllByVersionId).toHaveBeenCalledTimes(1);
    expect(getAllByUserAndVersionId).not.toHaveBeenCalled();
  });

  it('derives each enrollment percentage from the batched submissions', async () => {
    const {service, enrollments, userIds, bulkUpdateEnrollments} =
      makeService(3);

    await service.updateEnrollmentProgressPercentBulk(
      enrollments,
      GURU_SETU_COURSE_ID,
      GURU_SETU_VERSION_ID,
      10,
    );

    const ops = bulkUpdateEnrollments.mock.calls[0][0];
    const percentFor = (userId: ObjectId) =>
      ops.find((op: any) => op.updateOne.filter.userId.equals(userId))
        .updateOne.update.$set.percentCompleted;

    expect(percentFor(userIds[0])).toBe(100);
    expect(percentFor(userIds[1])).toBe(50);
    expect(percentFor(userIds[2])).toBe(0);
  });

  it('matches calculateGuruSetuProgress for the same user (parity)', async () => {
    const {service, enrollments, userIds, bulkUpdateEnrollments} =
      makeService(3);

    // the per-user path reads the same two forms, and this user's submissions
    service.feedbackRepository.getAllByUserAndVersionId = vi
      .fn()
      .mockResolvedValue([{userId: userIds[1], feedbackFormId: FORM_A}]);

    const perUser = await service.calculateGuruSetuProgress(
      userIds[1].toString(),
      GURU_SETU_VERSION_ID,
    );

    await service.updateEnrollmentProgressPercentBulk(
      enrollments,
      GURU_SETU_COURSE_ID,
      GURU_SETU_VERSION_ID,
      10,
    );

    const ops = bulkUpdateEnrollments.mock.calls[0][0];
    const batched = ops.find((op: any) =>
      op.updateOne.filter.userId.equals(userIds[1]),
    ).updateOne.update.$set.percentCompleted;

    expect(batched).toBe(perUser.percentCompleted);
  });

  it('returns null without writing when there are no enrollments', async () => {
    const {service, bulkUpdateEnrollments, getFeedbackItems} = makeService(0);

    const result = await service.updateEnrollmentProgressPercentBulk(
      [],
      GURU_SETU_COURSE_ID,
      GURU_SETU_VERSION_ID,
      10,
    );

    expect(result).toBeNull();
    expect(bulkUpdateEnrollments).not.toHaveBeenCalled();
    expect(getFeedbackItems).not.toHaveBeenCalled();
  });

  it('leaves non-Guru-Setu courses on the item-count formula', async () => {
    const {service, enrollments, getFeedbackItems, getAllByVersionId, bulkUpdateEnrollments} =
      makeService(2);
    enrollments[0].completedItemsCount = 5;

    await service.updateEnrollmentProgressPercentBulk(
      enrollments,
      new ObjectId().toString(),
      new ObjectId().toString(),
      10,
    );

    expect(getFeedbackItems).not.toHaveBeenCalled();
    expect(getAllByVersionId).not.toHaveBeenCalled();
    const ops = bulkUpdateEnrollments.mock.calls[0][0];
    expect(ops[0].updateOne.update.$set.percentCompleted).toBe(50);
  });
});
