import {inject, injectable} from 'inversify';
import {ObjectId} from 'mongodb';
import {randomUUID} from 'crypto';
import {NotFoundError} from 'routing-controllers';
import {CERTIFICATE_TYPES} from '../types.js';
import {CertificateRepository} from '../repositories/index.js';
import {ICertificate} from '../models.js';
import {CertificateResponse} from '../classes/index.js';
import {instanceToPlain, plainToInstance} from 'class-transformer';

@injectable()
class CertificateService {
  constructor(
    @inject(CERTIFICATE_TYPES.CertificateRepo)
    private readonly certificateRepo: CertificateRepository,
  ) {}

  /**
   * Called from ProgressService once percentCompleted reaches 100 for an
   * enrollment. Safe to call more than once for the same (user, course,
   * version) — returns the existing certificate instead of duplicating it,
   * so callers don't need to check completion state themselves first.
   *
   * studentName/courseName are passed in rather than looked up here — the
   * caller (ProgressService) already has the enrollment + course loaded in
   * memory at the point it detects completion, so this avoids a redundant
   * round trip for data the caller already has.
   */
  async issueIfNotExists(params: {
    userId: string;
    courseId: string;
    courseVersionId: string;
    studentName: string;
    courseName: string;
  }): Promise<ICertificate> {
    const userId = new ObjectId(params.userId);
    const courseId = new ObjectId(params.courseId);
    const courseVersionId = new ObjectId(params.courseVersionId);

    const existing = await this.certificateRepo.findExisting(
      userId,
      courseId,
      courseVersionId,
    );
    if (existing) return existing;

    const certificate: ICertificate = {
      userId,
      courseId,
      courseVersionId,
      studentName: params.studentName,
      courseName: params.courseName,
      certificateId: randomUUID(),
      issuedAt: new Date(),
    };

    return this.certificateRepo.create(certificate);
  }

  /** Public verification lookup — no auth, no ownership check by design. */
  async getByCertificateId(certificateId: string): Promise<CertificateResponse> {
    const certificate = await this.certificateRepo.findByCertificateId(certificateId);
    if (!certificate) {
      throw new NotFoundError('No certificate found with that ID');
    }
    return plainToInstance(CertificateResponse, instanceToPlain(certificate), {
      excludeExtraneousValues: true,
    });
  }

  /** "My certificates" list for the logged-in student's dashboard. */
  async getAllForUser(userId: string): Promise<CertificateResponse[]> {
    const certificates = await this.certificateRepo.findAllForUser(
      new ObjectId(userId),
    );
    return certificates.map(cert =>
      plainToInstance(CertificateResponse, instanceToPlain(cert), {
        excludeExtraneousValues: true,
      }),
    );
  }
}

export {CertificateService};
