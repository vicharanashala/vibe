import { describe, it, expect } from 'vitest';
import { BadRequestError } from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { EnrollmentService } from '#users/services/EnrollmentService.js';

/**
 * Unit tests for EnrollmentService.getCourseCompletions — the pagination
 * clamping and validation wrapper around EnrollmentRepository.getCourseCompletions.
 * Bypasses DI and stubs only enrollmentRepo, same approach as
 * ProgressService.leaderboard.test.ts.
 */
function makeService(getCourseCompletions: (courseId: string, skip: number, limit: number) => Promise<any>) {
  const service: any = Object.create(EnrollmentService.prototype);
  service.enrollmentRepo = { getCourseCompletions };
  return service as EnrollmentService;
}

describe('EnrollmentService.getCourseCompletions', () => {
  const validCourseId = new ObjectId().toString();

  it('rejects a non-ObjectId courseId before touching the repository', async () => {
    const service = makeService(async () => {
      throw new Error('should not be called');
    });

    await expect(
      service.getCourseCompletions('not-a-valid-id', 1, 50),
    ).rejects.toThrow(BadRequestError);
  });

  it('converts page/limit into skip and passes safe defaults through', async () => {
    let seen: any = null;
    const service = makeService(async (courseId, skip, limit) => {
      seen = { courseId, skip, limit };
      return { total: 0, candidates: [] };
    });

    await service.getCourseCompletions(validCourseId, 3, 20);

    expect(seen).toEqual({ courseId: validCourseId, skip: 40, limit: 20 });
  });

  it('clamps limit to 200 and floors page at 1', async () => {
    let seen: any = null;
    const service = makeService(async (courseId, skip, limit) => {
      seen = { skip, limit };
      return { total: 0, candidates: [] };
    });

    await service.getCourseCompletions(validCourseId, 0, 5000);

    expect(seen).toEqual({ skip: 0, limit: 200 });
  });

  it('computes totalPages from the repository total and echoes candidates through', async () => {
    const candidates = [{ userId: 'u1', email: 'a@b.com', name: 'A B', courseVersionId: 'v1', completedAt: new Date() }];
    const service = makeService(async () => ({ total: 101, candidates }));

    const result = await service.getCourseCompletions(validCourseId, 2, 50);

    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
    expect(result.totalCandidates).toBe(101);
    expect(result.totalPages).toBe(3);
    expect(result.candidates).toBe(candidates);
  });
});
