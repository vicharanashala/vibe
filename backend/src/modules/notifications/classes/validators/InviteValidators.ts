import {IsArray, IsEmail, ArrayNotEmpty, IsNumber, IsString, IsOptional, IsMongoId } from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

class InviteBody {
  @JSONSchema({
    title: 'Emails to Invite',
    description: 'List of valid email addresses of users to be invited',
    example: ['alice@example.com', 'bob@example.com'],
    type: 'array',
    items: {
      type: 'string',
      format: 'email',
    },
  })
  @IsArray({message: 'Emails must be an array'})
  @ArrayNotEmpty({message: 'Email list cannot be empty'})
  @IsEmail({}, {each: true, message: 'Each item must be a valid email address'})
  emails: string[];
}

class InviteResult {
  @JSONSchema({
    description: 'Email address of the invitee',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @JSONSchema({
    description: 'Status of the invitation process',
    example: 'invited',
    type: 'string',
  })
  @IsString()
  status: string; // e.g., invited, already_invited, failed
}

class InviteResponse {
  @JSONSchema({
    description: 'Indicates the operation was successful',
    example: true,
    type: 'boolean',
    readOnly: true,
  })
  success: boolean;

  @JSONSchema({
    description: 'List of emails invited',
    example: ['alice@example.com', 'bob@example.com'],
    type: 'array',
    items: {
      type: 'string',
      format: 'email',
    },
  })
  @IsArray()
  @IsEmail({}, {each: true})
  invitedEmails: string[];
}







export {
  InviteBody,
  InviteResponse, // either one of the response classes depending on your use case
};
