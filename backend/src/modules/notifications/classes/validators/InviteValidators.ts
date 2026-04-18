import { Course } from '#root/modules/courses/classes/index.js';
import { EnrollmentRole, ObjectIdToString, StringToObjectId } from '#root/shared/index.js';
import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsEmail, ArrayNotEmpty, IsNumber, IsString, IsOptional, IsMongoId, IsNotEmpty, IsEnum, ValidateNested, IsIn } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ObjectId } from 'mongodb';


class InviteIdParams {
  @JSONSchema({
    description: 'Unique identifier for the invite',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  inviteId: string;
}


class CourseAndVersionId {
  @JSONSchema({
    description: 'ID of the course to which users are being invited',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'ID of the specific version of the course',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  versionId: string;
}

class EmailInvite {
  @JSONSchema({
    description: 'Email address of the user to be invited',
    type: 'string',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @JSONSchema({
    description: 'Role that the user will have in the course',
    type: 'string',
    enum: ['INSTRUCTOR', 'STUDENT', 'MANAGER', 'TA', 'STAFF'],
    example: 'STUDENT',
  })
  @IsString()
  @IsIn(['INSTRUCTOR', 'STUDENT', 'MANAGER', 'TA', 'STAFF'])
  @IsNotEmpty()
  role: EnrollmentRole;
}


class InviteBody {

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EmailInvite)
  inviteData: EmailInvite[];
}
export type InviteStatus = 'ACCEPTED' | 'PENDING' | 'CANCELLED' | 'EMAIL_FAILED' | 'ALREADY_ENROLLED';

class InviteResult {
  @JSONSchema({
    description: 'Unique identifier for the invite',
    type: 'string',
    format: 'Mongo Object ID',
    example: '60c72b2f9b1e8d3f4c8b4567',
  })
  @IsString()
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  inviteId: ObjectId | string;

  @JSONSchema({
    description: 'Email address of the invited user',
    type: 'string',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @JSONSchema({
    description: `Status of the invite</br>
- ACCEPTED: User has accepted the invite
- PENDING: Invite is still pending
- CANCELLED: Invite has been cancelled
- EMAIL_FAILED: Email sending failed
- ALREADY_ENROLLED: User is already enrolled in the course
    `,
    type: 'string',
    enum: ['ACCEPTED', 'PENDING', 'CANCELLED', 'EMAIL_FAILED', 'ALREADY_ENROLLED'],
    example: 'PENDING',
  })
  @IsString()
  inviteStatus: InviteStatus;

  @JSONSchema({
    description: 'Role that the user will have in the course',
    type: 'string',
    enum: ['INSTRUCTOR', 'STUDENT', 'MANAGER', 'TA', 'STAFF'],
    example: 'STUDENT',
  })
  @IsString()
  role: EnrollmentRole = 'STUDENT';

  
  @IsString()
  @IsOptional()
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  courseId?: string | ObjectId;
  
  @IsString()
  @IsOptional()
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  courseVersionId?: string | ObjectId;
  
  @JSONSchema({
    description: 'Date when the invite was accepted',
    type: 'string',
    format: 'date-time',
    example: '2023-10-01T12:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  acceptedAt?: Date;
  
  @IsOptional()
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Type(() => Course)
  @ValidateNested({ each: true })
  course?: Course;

  constructor(inviteId: ObjectId | string, email: string, inviteStatus: InviteStatus, role: EnrollmentRole = 'STUDENT', acceptedAt?: Date,  courseId?: string | ObjectId, courseVersionId?: string | ObjectId, course?: Course) {
    this.inviteId = inviteId;
    this.email = email;
    this.inviteStatus = inviteStatus;
    this.role = role;
    this.course = course;
    this.courseId = courseId;
    this.courseVersionId = courseVersionId;
    if (inviteStatus == 'ACCEPTED' && acceptedAt) {
      this.acceptedAt = acceptedAt;
    }
  }
}

class InviteResponse {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InviteResult)
  invites: InviteResult[];

  constructor(invites: InviteResult[]) {
    this.invites = invites;
  }
}





export {
  InviteBody,
  CourseAndVersionId,
  InviteResponse, // either one of the response classes depending on your use case
  EmailInvite,
  InviteResult,
  InviteIdParams,
};
