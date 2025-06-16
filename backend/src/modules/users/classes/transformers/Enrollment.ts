import {
  ObjectIdToString,
  StringToObjectId,
} from '#root/shared/constants/transformerConstants.js';
import {
  EnrollmentRole,
  EnrollmentStatus,
  ID,
  IEnrollment,
} from '#root/shared/interfaces/models.js';
import {Expose, Transform, Type} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {Progress} from './Progress.js';

@Expose()
export class Enrollment implements IEnrollment {
  @Expose({toClassOnly: true})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  userId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseVersionId: ID;

  @Expose()
  role: EnrollmentRole;

  @Expose()
  status: EnrollmentStatus;

  @Expose()
  @Type(() => Date)
  enrollmentDate: Date;

  constructor(userId?: string, courseId?: string, courseVersionId?: string) {
    if (userId && courseId && courseVersionId) {
      this.userId = new ObjectId(userId);
      this.courseId = new ObjectId(courseId);
      this.courseVersionId = new ObjectId(courseVersionId);
      this.status = 'active';
      this.enrollmentDate = new Date();
    }
  }
}

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
