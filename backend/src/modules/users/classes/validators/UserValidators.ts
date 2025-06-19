import { IUser } from '#root/shared/interfaces/models.js';
import {IsNotEmpty, IsString, IsEmail} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

/**
 * Validator for Firebase UID parameter in user lookup endpoints.
 *
 * @category Users/Validators
 */
export class UserByFirebaseUIDParams {
  @JSONSchema({
    description: 'Firebase UID of the user to find',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  firebaseUID: string;
}

/**
 * Response type for successful user lookup by Firebase UID.
 *
 * @category Users/Validators
 */
export class UserByFirebaseUIDResponse implements IUser {
  @JSONSchema({
    description: 'Unique identifier for the user in the database',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  id: string;

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
  lastName: string;

  @JSONSchema({
    description: "User's roles",
    example: ['student'],
    type: 'array',
    items: {
      type: 'string',
    },
    readOnly: true,
  })
  roles: string[];
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