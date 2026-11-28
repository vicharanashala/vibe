import {IUser} from '#root/shared/interfaces/models.js';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import { ObjectId } from 'mongodb';

/**
 * Validator for Firebase UID parameter in user lookup endpoints.
 *
 * @category Users/Validators
 */
export class GetUserParams {
  @JSONSchema({
    description: 'User ID of the person',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

/**
 * Response type for successful user lookup by Firebase UID.
 *
 * @category Users/Validators
 */
export class GetUserResponse implements IUser {
  @JSONSchema({
    description: 'Unique identifier for the user in the database',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  _id?: string | ObjectId;

  @JSONSchema({
    description: 'Firebase UID of the user',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  firebaseUID: string;

  @JSONSchema({
    description: 'Email address of the user',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
    readOnly: true,
  })
  @IsEmail()
  email: string;

  @JSONSchema({
    description: "User's first name",
    example: 'John',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  firstName: string;

  @JSONSchema({
    description: "User's last name",
    example: 'Smith',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @JSONSchema({
    description: "User's avatar image URL or data URI",
    example: 'https://example.com/avatar.png',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @JSONSchema({
    description: "User's roles",
    example: 'admin',
    type: 'string',
    readOnly: true,
  })
  roles: 'admin' | 'user';
}

export class EditUserBody{
  @JSONSchema({
    description: "User's first name",
    example: 'John',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @JSONSchema({
    description: "User's last name",
    example: 'Smith',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @JSONSchema({
    description: "User's avatar image URL or data URI",
    example: 'https://example.com/avatar.png',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @JSONSchema({
    description: "User's gender",
    example: 'Male',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  gender?: string;

  @JSONSchema({
    description: "User's country",
    example: 'India',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  country?: string;

  @JSONSchema({
    description: "User's state",
    example: 'Maharashtra',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  state?: string;

  @JSONSchema({
    description: "User's city",
    example: 'Pune',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsOptional()
  city?: string;
}

export class UpdateFaceReferenceBody {
  @JSONSchema({
    description: 'Profile image as a data URL or remote URL',
    example: 'data:image/jpeg;base64,/9j/4AAQSk...',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  profileImage: string;

  @JSONSchema({
    description: '128-length face embedding generated from the registration image',
    type: 'array',
    items: {type: 'number'},
  })
  @IsArray()
  @ArrayMinSize(128)
  @ArrayMaxSize(128)
  @IsNumber({}, {each: true})
  faceEmbedding: number[];
}

export class UpdateFaceReferenceHumanBody {
  @JSONSchema({
    description: 'Profile image as a data URL or remote URL',
    example: 'data:image/jpeg;base64,/9j/4AAQSk...',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  profileImage: string;

  @JSONSchema({
    description: '1024-length @vladmandic/human face embedding generated from the registration image (old-vibe only -- see faceEmbeddingHuman on IUser)',
    type: 'array',
    items: {type: 'number'},
  })
  @IsArray()
  @ArrayMinSize(1024)
  @ArrayMaxSize(1024)
  @IsNumber({}, {each: true})
  faceEmbeddingHuman: number[];
}

/**
 * Error response when user is not found.
 *
 * @category Users/Validators
 */
export class UserNotFoundErrorResponse {
  @JSONSchema({
    description: 'Error message indicating user was not found',
    example: 'User not found with the provided Firebase UID',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  message: string;
}

export const USER_VALIDATORS = [
  GetUserParams,
  GetUserResponse,
  UserNotFoundErrorResponse
]

export class ChangeUserEmailBody {
  @JSONSchema({
    description: 'The new sign-in email for the user',
    example: 'new.address@example.com',
    type: 'string',
  })
  @IsEmail({}, {message: 'Enter a valid email address'})
  @MaxLength(254)
  email: string;
}

export class ChangeUserEmailResponse {
  @JSONSchema({description: 'The new email', type: 'string'})
  @IsString()
  email: string;

  @JSONSchema({description: 'The email before the change', type: 'string'})
  @IsString()
  previousEmail: string;

  @JSONSchema({
    description:
      "The account's sign-in methods, e.g. 'password' and 'google.com'",
    type: 'array',
    items: {type: 'string'},
  })
  @IsString({each: true})
  signInMethods: string[];
}
