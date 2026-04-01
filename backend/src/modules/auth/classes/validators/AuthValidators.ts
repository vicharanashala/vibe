import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  Matches,
  IsOptional,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

class ForgotPasswordBody {
  @JSONSchema({
    title: 'Email Address',
    description: 'Email address to send the reset link to',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
  })
  @IsEmail(undefined, {message: 'Invalid email address'})
  email: string;

  @JSONSchema({
    title: 'reCAPTCHA Token',
    description:
      'reCAPTCHA verification token obtained from the frontend widget (required when reCAPTCHA is enabled)',
    example: '03AGdBq27...',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  recaptchaToken: string;
}

class ForgotPasswordResponse {
  @JSONSchema({
    description:
      'Always true to avoid leaking whether the email exists in the system',
    example: true,
    type: 'boolean',
    readOnly: true,
  })
  success: boolean;

  @JSONSchema({
    description: 'User-facing status message',
    example: 'If an account exists, a reset link has been sent.',
    type: 'string',
    readOnly: true,
  })
  message: string;
}

class SignUpBody {
  @JSONSchema({
    title: 'Email Address',
    description: 'Email address of the user, used as login identifier',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
  })
  @IsEmail(undefined, {
    message: 'Invalid email address',
  })
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
  @Matches(/^[A-Za-z ]+$/, {
    message: 'name can only contain alphabetic characters and spaces',
  })
  firstName: string;

  @JSONSchema({
    title: 'Last Name',
    description: "User's last name (alphabetic characters only)",
    example: 'Smith',
    type: 'string',
  })
  @Matches(/^[A-Za-z ]+$/, {
    message: 'name can only contain alphabetic characters and spaces',
  })
  @IsOptional()
  lastName?: string;

  @JSONSchema({
    title: 'reCAPTCHA Token',
    description:
      'reCAPTCHA verification token obtained from the frontend widget',
    example: '03AGdBq27...',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  recaptchaToken: string;
}

class GoogleSignUpBody {
  @JSONSchema({
    title: 'Email Address',
    description: 'Email address of the user, used as login identifier',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
  })
  @IsEmail(undefined, {
    message: 'Invalid email address',
  })
  email: string;

  @JSONSchema({
    title: 'First Name',
    description: "User's first name (alphabetic characters only)",
    example: 'John',
    type: 'string',
  })
  @Matches(/^[A-Za-z ]+$/, {
    message: 'name can only contain alphabetic characters and spaces',
  })
  firstName: string;

  @JSONSchema({
    title: 'Last Name',
    description: "User's last name (alphabetic characters only)",
    example: 'Smith',
    type: 'string',
  })
  @Matches(/^[A-Za-z ]+$/, {
    message: 'name can only contain alphabetic characters and spaces',
  })
  @IsOptional()
  lastName?: string;
}

class VerifySignUpProviderBody {
  @JSONSchema({
    title: 'Firebase Auth Token',
    description: 'Firebase Auth Token',
    example: '43jdlsaksla;f328e9fjhsda',
    type: 'string',
  })
  @IsString()
  token: string;
}

class ChangePasswordBody {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^[A-Za-z ]+$/, {
    message: 'Password Invalid',
  })
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
    minLength: 8,
    writeOnly: true,
  })
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^[A-Za-z ]+$/, {
    message: 'Password Invalid',
  })
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

class LoginBody {
  @JSONSchema({
    title: 'Email Address',
    description: 'Email address of the user',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @JSONSchema({
    title: 'Password',
    description: 'Password for account authentication',
    example: 'SecureP@ssw0rd',
    minLength: 8,
    writeOnly: true,
  })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @JSONSchema({
    title: 'reCAPTCHA Token',
    description:
      'reCAPTCHA verification token obtained from the frontend widget',
    example: '03AGdBq27...',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

class LoginResponse {
  @JSONSchema({
    description: 'Local ID of the user',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
  })
  @IsString()
  localId: string;

  @JSONSchema({
    description: 'Email address of the user',
    example: 'user@example.com',
    type: 'string',
    format: 'email',
  })
  @IsString()
  email: string;

  @JSONSchema({
    description: 'Display name of the user',
    example: 'John Doe',
    type: 'string',
  })
  @IsString()
  displayName: string;

  @JSONSchema({
    description: 'ID token of the user',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
  })
  @IsString()
  idToken: string;

  @JSONSchema({
    description: 'Refresh token of the user',
    example: 'cKy6H2O04PgTh8O3DpUXjgJYUr53',
    type: 'string',
  })
  @IsString()
  refreshToken: string;

  @JSONSchema({
    description: 'Expiry time of the ID token',
    example: '3600',
    type: 'number',
  })
  expiresIn: Number;
}

export const AUTH_VALIDATORS = [
  SignUpBody,
  GoogleSignUpBody,
  ChangePasswordBody,
  ForgotPasswordBody,
  SignUpResponse,
  VerifySignUpProviderBody,
  ChangePasswordResponse,
  TokenVerificationResponse,
  AuthErrorResponse,
  LoginBody,
  LoginResponse,
  ForgotPasswordResponse,
];

export {
  SignUpBody,
  GoogleSignUpBody,
  ChangePasswordBody,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  SignUpResponse,
  VerifySignUpProviderBody,
  ChangePasswordResponse,
  TokenVerificationResponse,
  AuthErrorResponse,
  LoginBody,
  LoginResponse,
};
