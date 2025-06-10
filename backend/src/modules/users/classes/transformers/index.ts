import {EnrollmentRole, EnrollmentStatus} from '#shared/index.js';
import {Expose, Type} from 'class-transformer';
import {Enrollment} from './Enrollment.js';
import {Progress} from './Progress.js';

export * from './Enrollment.js';
export * from './Progress.js';

@Expose({toPlainOnly: true})
export class EnrollUserResponse {
  @Expose()
  @Type(() => Enrollment)
  enrollment: Enrollment;

  @Expose()
  @Type(() => Progress)
  progress: Progress;

  @Expose()
  @Type(() => String)
  role: EnrollmentRole;

  constructor(
    enrollment: Enrollment,
    progress: Progress,
    role: EnrollmentRole,
  ) {
    this.enrollment = enrollment;
    this.progress = progress;
    this.role = role;
  }
}
export class EnrolledUserResponse {
  @Expose()
  @Type(() => String)
  role: EnrollmentRole;

  @Expose()
  @Type(() => String)
  status: EnrollmentStatus;

  @Expose()
  @Type(() => Date)
  enrollmentDate: Date;

  constructor(
    role: EnrollmentRole,
    status: EnrollmentStatus,
    enrollmentDate: Date,
  ) {
    this.role = role;
    this.status = status;
    this.enrollmentDate = enrollmentDate;
  }
}
