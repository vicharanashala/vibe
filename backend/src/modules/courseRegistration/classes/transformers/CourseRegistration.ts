import {Expose, Transform, Type} from 'class-transformer';
import {IsEnum, IsObject} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';
import {ID, ObjectIdToString, StringToObjectId} from '#root/shared/index.js';

enum RegistrationStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

const REGISTRATION_STATUS_VALUES = Object.values(RegistrationStatusEnum);

class CourseRegistration {
  @Expose()
  @JSONSchema({
    title: 'Registration ID',
    description: 'Unique identifier for the course registration',
    example: '60d5ec49b3f1c8e4a8f8d111',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: ID;

  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'Identifier of the course being registered',
    example: '60d5ec49b3f1c8e4a8f8d112',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseId: ID;

  @Expose()
  @JSONSchema({
    title: 'Course Version ID',
    description: 'Identifier of the course version being registered',
    example: '60d5ec49b3f1c8e4a8f8d113',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  versionId: ID;

  @Expose()
  @JSONSchema({
    title: 'User ID',
    description: 'Identifier of the user registering for the course',
    example: '60d5ec49b3f1c8e4a8f8d114',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  userId: ID;

  @Expose()
  @IsObject()
  @JSONSchema({
    title: 'Registration Details',
    description: 'Additional information provided during registration',
    example: {priorExperience: 'Intermediate', preferredLanguage: 'English'},
    type: 'object',
    additionalProperties: true,
  })
  detail: Record<string, any>;

  @Expose()
  @IsEnum(RegistrationStatusEnum)
  @JSONSchema({
    title: 'Status',
    description: 'Current status of the registration',
    example: RegistrationStatusEnum.PENDING,
    type: 'string',
    enum: REGISTRATION_STATUS_VALUES,
  })
  status: RegistrationStatusEnum;

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Created At',
    description: 'Timestamp when the registration was created',
    example: '2025-07-24T10:44:00Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Updated At',
    description: 'Timestamp when the registration was last updated',
    example: '2025-07-24T10:44:00Z',
    type: 'string',
    format: 'date-time',
  })
  updatedAt?: Date;

  constructor(
    courseId: ID,
    versionId: ID,
    userId: ID,
    detail: Record<string, any>,
    status: RegistrationStatusEnum = RegistrationStatusEnum.PENDING,
  ) {
    this.courseId = new ObjectId(courseId);
    this.versionId = new ObjectId(versionId);
    this.userId = new ObjectId(userId);
    this.detail = detail;
    this.status = status;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export {CourseRegistration, RegistrationStatusEnum, REGISTRATION_STATUS_VALUES};
