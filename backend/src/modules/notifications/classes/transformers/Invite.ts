import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {
  ObjectIdArrayToStringArray,
  StringArrayToObjectIdArray,
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {ID} from '#shared/interfaces/models.js';
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
} from 'class-validator';
import {IInvite, InviteActionType, InviteStatusType} from '#shared/interfaces/models.js'; // Your IInvite interface and actionType
/**
 * Course data transformation.
 *
 * @category Courses/Transformers
 */
class Invite implements IInvite {
  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'Unique identifier for the course',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, {toClassOnly: true}) // Convert string -> ObjectId when deserializing
  _id?: ID;

  @Expose()
  status: InviteStatusType;
  @Expose()
  @Type(() => Date)
  expiresAt: Date;

  @Expose()
  @JSONSchema({
    title: 'Course Name',
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  name: string;
  @Expose() // Make sure email is exposed for serialization/deserialization
  @JSONSchema({
    title: 'Recipient Email',
    description: 'The email address of the person being invited.',
    example: 'invitee@example.com',
    type: 'string',
    format: 'email', // Use 'format: "email"' for better OpenAPI documentation
  })
  @IsNotEmpty({message: 'Email is required.'})
  @IsString({message: 'Email must be a string.'})
  @IsEmail({}, {message: 'Email must be a valid email address.'})
  email: string;

  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'The unique identifier of the course the invite is for.',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsNotEmpty({message: 'Course ID is required.'})
  @IsString({message: 'Course ID must be a string.'})
  @IsMongoId({message: 'Course ID must be a valid MongoDB ObjectId string.'})
  courseId: string;
  @Expose()
  @JSONSchema({
    title: 'Course Version ID',
    description:
      'The unique identifier of the specific course version for the invite.',
    example: '60d5ec49b3f1c8e4a8f8b8c2', // Example for documentation
    type: 'string', // The type expected in the incoming JSON payload
    format: 'Mongo Object ID', // Custom format to indicate it's a Mongo ObjectId
  })
  @IsNotEmpty({message: 'Course Version ID is required.'})
  @IsString({message: 'Course Version ID must be a string.'})
  @IsMongoId({
    message: 'Course Version ID must be a valid MongoDB ObjectId string.',
  })
  courseVersionId: string; // <-- This should be 'string' in your DTO for validation
  @Expose()
  token: string;
  @Expose()
  action: InviteActionType;

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Course Created At',
    description: 'Timestamp when the course was created',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt: Date | null;
}


@Expose({ toPlainOnly: true }) // Only expose fields during serialization (class → JSON)
export class InviteProResponse {
  @Expose()
  @IsNumber()
  statusCode: number;

  @Expose()
  @IsString()
  error: string;

  @Expose()
  @IsString()
  message: string;

  @Expose()
  @IsOptional()
  @IsMongoId()
  @Type(() => String)
  courseId?: string;

  @Expose()
  @IsOptional()
  @IsMongoId()
  @Type(() => String)
  courseVersionId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  email?: string;

  constructor(
    statusCode: number,
    error: string,
    message: string,
    courseId?: string,
    courseVersionId?: string,
    email?: string
  ) {
    this.statusCode = statusCode;
    this.error = error;
    this.message = message;
    this.courseId = courseId;
    this.courseVersionId = courseVersionId;
    this.email = email;
  }
}









export {Invite};
