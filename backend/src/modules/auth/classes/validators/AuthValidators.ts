import {
  IsAlpha,
  IsEmail,
  IsNotEmpty,
  Matches,
  MinLength,
  IsString,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

class SignUpBody {
  @JSONSchema({
    title: 'Email Address',
    description: 'Email address of the user, used as login identifier',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @JSONSchema({
    title: 'Password',
    description:
      'Password for account authentication (minimum 8 characters). Must contain: <br />\
1. **Uppercase letters** (A–Z)  <br /> \
2. **Lowercase letters** (a–z)  <br /> \
3. **Numbers** (0–9)   <br />\
4. **Special symbols** (`! @ # $ % ^ & * ( ) – _ = + [ ] { } | ; : , . ? /`) ',
    example: 'SecureP@ssw0rd',
    type: 'string',
    minLength: 8,
    format: 'password',
    writeOnly: true,
  })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @JSONSchema({
    title: 'First Name',
    description: "User's first name (alphabetic characters only)",
    example: 'John',
    type: 'string',
  })
  @IsAlpha()
  firstName: string;

  @JSONSchema({
    title: 'Last Name',
    description: "User's last name (alphabetic characters only)",
    example: 'Smith',
    type: 'string',
  })
  @IsAlpha()
  lastName: string;
}

class ChangePasswordBody {
  @JSONSchema({
    title: 'New Password',
    description:
      'New password that meets security requirements.  Must contain: <br />\
1. **Uppercase letters** (A–Z)  <br /> \
2. **Lowercase letters** (a–z)  <br /> \
3. **Numbers** (0–9)   <br />\
4. **Special symbols** (`! @ # $ % ^ & * ( ) – _ = + [ ] { } | ; : , . ? /`) ',
    example: 'SecureP@ssw0rd',
    type: 'string',
    format: 'password',
    minLength: 8,
    writeOnly: true,
  })
  newPassword: string;

  @JSONSchema({
    title: 'Confirm New Password',
    description:
      'Confirmation of the new password (must match exactly). Must contain: <br />\
1. **Uppercase letters** (A–Z)  <br /> \
2. **Lowercase letters** (a–z)  <br /> \
3. **Numbers** (0–9)   <br />\
4. **Special symbols** (`! @ # $ % ^ & * ( ) – _ = + [ ] { } | ; : , . ? /`) ',
    example: 'SecureP@ssw0rd',
    type: 'string',
    format: 'password',
    minLength: 8,
    writeOnly: true,
  })
  newPasswordConfirm: string;
}

class SignUpResponse {
  @JSONSchema({
    description: 'Unique identifier for the user',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  @IsString()
  uid: string;

  @JSONSchema({
    description: 'Email address of the registered user',
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
}

class ChangePasswordResponse {
  @JSONSchema({
    description: 'Indicates the operation was successful',
    example: true,
    type: 'boolean',
    readOnly: true,
  })
  @IsNotEmpty()
  success: boolean;

  @JSONSchema({
    description: 'Success message',
    example: 'Password changed successfully',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  message: string;
}

class TokenVerificationResponse {
  @JSONSchema({
    description: 'Confirmation message for valid token',
    example: 'Token is valid',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  message: string;
}

class AuthErrorResponse {
  @JSONSchema({
    description: 'The error message',
    example: 'Invalid credentials. Please check your email and password.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}

export {
  SignUpBody,
  ChangePasswordBody,
  SignUpResponse,
  ChangePasswordResponse,
  TokenVerificationResponse,
  AuthErrorResponse,
};
