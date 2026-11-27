import { describe, it, expect } from 'vitest';
import { NotFoundError } from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { EnrollmentService } from '#users/services/EnrollmentService.js';

/**
 * Unit tests for EnrollmentService.getProctoringDeclaration/recordProctoringDeclaration
 * -- the Declaration-consent persistence pair, mirroring getEthicsConsent/
 * recordEthicsConsent. Bypasses DI and stubs only enrollmentRepo, same
 * approach as EnrollmentService.courseVersionProgress.test.ts.
 */
function makeService(enrollmentRepo: Record<string, (...args: any[]) => any>) {
  const service: any = Object.create(EnrollmentService.prototype);
  service.enrollmentRepo = enrollmentRepo;
  return service as EnrollmentService;
}

describe('EnrollmentService.getProctoringDeclaration / recordProctoringDeclaration', () => {
  const userId = new ObjectId().toString();
  const courseId = new ObjectId().toString();
  const versionId = new ObjectId().toString();

  it('getProctoringDeclaration throws NotFoundError when no enrollment exists', async () => {
    const service = makeService({ findEnrollment: async () => null });

    await expect(
      (service as any).getProctoringDeclaration(userId, courseId, versionId),
    ).rejects.toThrow(NotFoundError);
  });

  it('getProctoringDeclaration reports acked:false when the field was never set', async () => {
    const service = makeService({ findEnrollment: async () => ({}) });

    const result = await (service as any).getProctoringDeclaration(userId, courseId, versionId);

    expect(result).toEqual({ acked: false, ackedAt: undefined });
  });

  it('getProctoringDeclaration reports acked:true with the stored timestamp', async () => {
    const ackedAt = new Date('2026-01-01T00:00:00.000Z');
    const service = makeService({
      findEnrollment: async () => ({ proctoringDeclarationAckedAt: ackedAt }),
    });

    const result = await (service as any).getProctoringDeclaration(userId, courseId, versionId);

    expect(result).toEqual({ acked: true, ackedAt });
  });

  it('recordProctoringDeclaration throws NotFoundError when no enrollment exists', async () => {
    const service = makeService({
      findEnrollment: async () => null,
      recordProctoringDeclaration: async () => {
        throw new Error('repository write should not be reached');
      },
    });

    await expect(
      (service as any).recordProctoringDeclaration(userId, courseId, versionId),
    ).rejects.toThrow(NotFoundError);
  });

  it('recordProctoringDeclaration writes through the repository and returns acked:true', async () => {
    let seen: any = null;
    const service = makeService({
      findEnrollment: async () => ({}),
      recordProctoringDeclaration: async (uid: string, cid: string, vid: string) => {
        seen = { uid, cid, vid };
      },
    });

    const result = await (service as any).recordProctoringDeclaration(userId, courseId, versionId);

    expect(seen).toEqual({ uid: userId, cid: courseId, vid: versionId });
    expect(result.acked).toBe(true);
    expect(result.ackedAt).toBeInstanceOf(Date);
  });
});
