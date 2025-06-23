import {
  IUserAnomaly,
  ObjectIdToString,
  StringToObjectId,
  ID,
  EnrollmentRole,
  EnrollmentStatus,
  IUser,
} from '#shared/index.js';
import {Expose, Transform, Type} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {CreateAnamolyBody} from '../validators/AnamolyValidators.js';

@Expose()
export class Anomaly implements IUserAnomaly {
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
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  moduleId?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  sectionId?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  itemId?: ID;

  @Expose()
  anomalyType: string;

  constructor(anomalyBody: CreateAnamolyBody) {
    this.userId = new ObjectId(anomalyBody.userId);
    this.courseId = new ObjectId(anomalyBody.courseId);
    this.courseVersionId = new ObjectId(anomalyBody.courseVersionId);
    if (anomalyBody.moduleId)
      this.moduleId = new ObjectId(anomalyBody.moduleId);
    if (anomalyBody.sectionId)
      this.sectionId = new ObjectId(anomalyBody.sectionId);
    if (anomalyBody.itemId) this.itemId = new ObjectId(anomalyBody.itemId);
    this.anomalyType = anomalyBody.anomalyType;
  }
}
