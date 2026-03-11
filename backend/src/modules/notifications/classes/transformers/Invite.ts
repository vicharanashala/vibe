import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {EnrollmentRole, ID, InviteType} from '#shared/interfaces/models.js';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  ArrayMinSize,
  IsMongoId,
  IsArray,
  IsEmail,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import {IInvite, InviteActionType, InviteStatusType} from '#shared/interfaces/models.js'; // Your IInvite interface and actionType

class Invite {
  @JSONSchema({
    title: 'Course ID',
    description: 'Unique identifier for the course',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, {toClassOnly: true}) // Convert string -> ObjectId when deserializing
  _id?: ID;

  @Type(() => Date)
  expiresAt: Date;


  @JSONSchema({
    title: 'Recipient Email',
    description: 'The email address of the person being invited.',
    example: 'invitee@example.com',
    type: 'string',
  })
  // @IsNotEmpty()
  @IsOptional()
  @IsString()
  @IsEmail()
  email: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'The unique identifier of the course the invite is for.',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: ID;

  @JSONSchema({
    title: 'Course Version ID',
    description:
      'The unique identifier of the specific course version for the invite.',
    type: 'string', // The type expected in the incoming JSON payload
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: ID; 


  inviteStatus: 'ACCEPTED' | 'PENDING' | 'EXPIRED' |'CANCELLED' |'REJECTED'| 'EMAIL_FAILED' | 'ALREADY_ENROLLED' = 'PENDING';
  


  @IsBoolean()
  isAlreadyEnrolled?: boolean;

  @IsBoolean()
  isNewUser?: boolean;

  role: EnrollmentRole = 'STUDENT';

  @Type(() => Date)
  @JSONSchema({
    title: 'Course Created At',
    description: 'Timestamp when the course was created',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt: Date | null;

  @Type(() => Date)
  @IsOptional()
  @JSONSchema({
    title: 'Accepted At',
    description: 'Timestamp when the user accepted the invite',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  acceptedAt?: Date;

  type:InviteType = InviteType.SINGLE
  usedCount:number
  // inviteStatus:InviteStatusType
  // constructor(
  //   email: string,
  //   courseId: ID,
  //   courseVersionId: ID,
  //   role: EnrollmentRole = 'STUDENT',
  //   isAlreadyEnrolled: boolean = false,
  //   isNewUser: boolean = false,
  //   expiresAt: Date,
  // ) {
  //   this.email = email;
  //   this.courseId = courseId;
  //   this.courseVersionId = courseVersionId;
  //   this.expiresAt = expiresAt;
  //   this.role = role;
  //   this.isAlreadyEnrolled = isAlreadyEnrolled;
  //   this.isNewUser = isNewUser;
  //   this.createdAt = new Date();
  //   if(this.isAlreadyEnrolled) {
  //     this.inviteStatus = 'ALREADY_ENROLLED';
  //   }
  // }

  constructor(
    opts: {
      email?: string;
      courseId: ID;
      courseVersionId: ID;
      role?: EnrollmentRole;
      isAlreadyEnrolled?: boolean;
      isNewUser?: boolean;
      expiresAt: Date;
      type?: InviteType;
    }
  ) {
    this.email = opts.email;
    this.courseId = opts.courseId;
    this.courseVersionId = opts.courseVersionId;
    this.expiresAt = opts.expiresAt;
    this.role = opts.role ?? 'STUDENT';
    this.isAlreadyEnrolled = opts.isAlreadyEnrolled ?? false;
    this.isNewUser = opts.isNewUser ?? false;
    this.createdAt = new Date();
    this.type = opts.type ?? InviteType.SINGLE;

    if (this.isAlreadyEnrolled) {
      this.inviteStatus = 'ALREADY_ENROLLED';
    }
  }
}


@Expose()
export class MessageResponse {
  
  @IsString()
  @Expose()
  @JSONSchema({
    title: 'Message',
    description: 'The message to be displayed',
    example: 'It return Dynamic html Template',
    type: 'string',
  })
  message: string
}

@Expose()
export class ResendInviteResponse {
  
  @IsString()
  @Expose()
  @JSONSchema({
    title: 'Message',
    description: 'The message to be displayed',
    example: 'Invite resent successfully',
    type: 'string',
  })
  message: string
}

export class CancelInviteResponse{

  @IsString()
  @Expose()
  @JSONSchema({
    title: 'Message',
    description: 'The message to be displayed',
    example: 'Invite has been cancelled successfully.',
    type: 'string',
  })
  message: string
}
export {Invite};