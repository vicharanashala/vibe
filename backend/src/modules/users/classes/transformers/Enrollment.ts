import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {
  ObjectIdToString,
  StringToObjectId,
} from 'shared/constants/transformerConstants';
import {IEnrollment} from 'shared/interfaces/Models';
import {ID} from 'shared/types';

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
  status: 'active' | 'inactive';

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
