import {IsMongoId} from 'class-validator';
import {Expose} from 'class-transformer';

/**
 * Route params for GET /certificates/course/:courseId/:courseVersionId
 * (used by the "check my own certificate for this course" button — this one
 * IS behind auth, scoped to the current user via CurrentUser in the controller)
 */
export class GetMyCertificateParams {
  @IsMongoId()
  courseId: string;

  @IsMongoId()
  courseVersionId: string;
}

/**
 * What we actually return to the frontend. Deliberately excludes _id and
 * userId — the frontend only needs enough to render the PDF and show the
 * verification link. courseId/courseVersionId ARE included (unlike userId)
 * since the dashboard needs them to match a certificate back to the
 * specific completed enrollment it belongs to — they're not sensitive on
 * their own, just internal identifiers.
 */
export class CertificateResponse {
  @Expose()
  certificateId: string;

  @Expose()
  studentName: string;

  @Expose()
  courseName: string;

  @Expose()
  courseId: string;

  @Expose()
  courseVersionId: string;

  @Expose()
  issuedAt: Date;
}

export const CERTIFICATE_VALIDATORS = [
  GetMyCertificateParams,
  CertificateResponse,
];
