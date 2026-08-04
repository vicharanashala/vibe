import { describe, it, expect } from 'vitest';
import { BadRequestError } from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { EnrollmentService } from '#users/services/EnrollmentService.js';

/**
 * Unit tests for EnrollmentService.getCourseVersionProgress — the validation
 * and pagination wrapper around EnrollmentRepository.getCourseProgressRoster
 * that backs the server-to-server progress integration endpoint.
 * Bypasses DI and stubs only enrollmentRepo, same approach as
 * EnrollmentService.courseCompletions.test.ts.
 */
function makeService(
  getCourseProgressRoster: (
    courseId: string,
    courseVersionId: string,
    cohortId: string | undefined,
    skip: number,
    limit: number,
  ) => Promise<any>,
) {
  const service: any = Object.create(EnrollmentService.prototype);
  service.enrollmentRepo = { getCourseProgressRoster };
  return service as EnrollmentService;
}

describe('EnrollmentService.getCourseVersionProgress', () => {
  const courseId = new ObjectId().toString();
  const versionId = new ObjectId().toString();
  const cohortId = new ObjectId().toString();

  const neverCalled = makeService(async () => {
    throw new Error('repository should not be called');
  });

  it('rejects a non-ObjectId courseId before touching the repository', async () => {
    await expect(
      (neverCalled as any).getCourseVersionProgress('nope', versionId, undefined, 1, 50),
    ).rejects.toThrow(BadRequestError);
  });

  it('rejects a non-ObjectId versionId before touching the repository', async () => {
    await expect(
      (neverCalled as any).getCourseVersionProgress(courseId, 'nope', undefined, 1, 50),
    ).rejects.toThrow(BadRequestError);
  });

  it('rejects a malformed cohortId rather than silently returning every cohort', async () => {
    await expect(
      (neverCalled as any).getCourseVersionProgress(courseId, versionId, 'nope', 1, 50),
    ).rejects.toThrow(BadRequestError);
  });

  it('converts page/limit into skip and threads cohortId through', async () => {
    let seen: any = null;
    const service: any = makeService(async (cid, vid, cohort, skip, limit) => {
      seen = { cid, vid, cohort, skip, limit };
      return { total: 0, learners: [] };
    });

    await service.getCourseVersionProgress(courseId, versionId, cohortId, 3, 20);

    expect(seen).toEqual({
      cid: courseId,
      vid: versionId,
      cohort: cohortId,
      skip: 40,
      limit: 20,
    });
  });

  it('clamps limit to 200 and floors page at 1', async () => {
    let seen: any = null;
    const service: any = makeService(async (_c, _v, _co, skip, limit) => {
      seen = { skip, limit };
      return { total: 0, learners: [] };
    });

    await service.getCourseVersionProgress(courseId, versionId, undefined, 0, 5000);

    expect(seen).toEqual({ skip: 0, limit: 200 });
  });

  it('returns an empty page instead of throwing when nobody has started', async () => {
    const service: any = makeService(async () => ({ total: 0, learners: [] }));

    const result = await service.getCourseVersionProgress(
      courseId,
      versionId,
      cohortId,
      1,
      50,
    );

    expect(result.totalLearners).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.learners).toEqual([]);
    expect(result.cohortId).toBe(cohortId);
  });

  it('computes totalPages and echoes partially-complete learners through', async () => {
    const learners = [
      {
        userId: 'u1',
        email: 'a@b.com',
        name: 'A B',
        courseVersionId: versionId,
        cohortId,
        percentCompleted: 42,
        completedItems: 21,
        totalItems: 50,
        completed: false,
      },
    ];
    const service: any = makeService(async () => ({ total: 101, learners }));

    const result = await service.getCourseVersionProgress(
      courseId,
      versionId,
      cohortId,
      2,
      50,
    );

    expect(result).toEqual({
      page: 2,
      limit: 50,
      totalLearners: 101,
      totalPages: 3,
      cohortId,
      learners,
    });
  });

  it('reports a null cohortId when the caller did not scope to one', async () => {
    const service: any = makeService(async () => ({ total: 0, learners: [] }));

    const result = await service.getCourseVersionProgress(
      courseId,
      versionId,
      undefined,
      1,
      50,
    );

    expect(result.cohortId).toBeNull();
  });
});
