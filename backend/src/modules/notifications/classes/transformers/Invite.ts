import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {EnrollmentRole, ID} from '#shared/interfaces/models.js';
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
    format: 'email', // Use 'format: "email"' for better OpenAPI documentation
  })
  @IsNotEmpty()
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
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description:
      'The unique identifier of the specific course version for the invite.',
    type: 'string', // The type expected in the incoming JSON payload
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: string; 


  inviteStatus: 'ACCEPTED' | 'PENDING' | 'CANCELLED' | 'EMAIL_FAILED' | 'ALREADY_ENROLLED' = 'PENDING';


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


  constructor(
    email: string,
    courseId: string,
    courseVersionId: string,
    role: EnrollmentRole = 'STUDENT',
    isAlreadyEnrolled: boolean = false,
    isNewUser: boolean = false,
    expiresAt: Date,
  ) {
    this.email = email;
    this.courseId = courseId;
    this.courseVersionId = courseVersionId;
    this.expiresAt = expiresAt;
    this.role = role;
    this.isAlreadyEnrolled = isAlreadyEnrolled;
    this.isNewUser = isNewUser;
    this.createdAt = new Date();
    if(this.isAlreadyEnrolled) {
      this.inviteStatus = 'ALREADY_ENROLLED';
    }
  }
}


@Expose()
export class MessageResponse {
  @Expose()
  message: string
}


export {Invite};
