import { IUser } from '#root/shared/interfaces/models.js';
import {IsNotEmpty, IsString, IsEmail, IsOptional} from 'class-validator';
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
  @IsNotEmpty()
  firstName: string;

  @JSONSchema({
    description: "User's last name",
    example: 'Smith',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;
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