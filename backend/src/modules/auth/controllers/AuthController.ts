import 'reflect-metadata';
import {
  JsonController,
  Post,
  Body,
  Authorized,
  Req,
  Patch,
  HttpError,
  HttpCode,
  UseBefore,
} from 'routing-controllers';
import {Inject, Service} from 'typedi';
import {AuthenticatedRequest, IAuthService} from '../interfaces/IAuthService';
import {instanceToPlain} from 'class-transformer';
import {ChangePasswordError} from '../services/FirebaseAuthService';
import {
  ChangePasswordBody,
  SignUpBody,
  SignUpResponse,
  ChangePasswordResponse,
  TokenVerificationResponse,
  AuthErrorResponse,
  VerifySignUpProviderBody,
} from '../classes/validators';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';
import {AuthRateLimiter} from 'shared/middleware/rateLimiter';
import {CreateError} from 'shared/errors/errors';

@OpenAPI({
  tags: ['Authentication'],
})
@JsonController('/auth')
@Service()
export class AuthController {
  /**
   * Creates a new instance of the AuthController.
   * Uses dependency injection to receive an implementation of IAuthService.
   *
   * @param authService - The authentication service implementation to use
   */
  constructor(
    @Inject('AuthService') private readonly authService: IAuthService,
  ) {}

  /**
   * Handles user signup/registration requests.
   * Creates new user accounts using the provided credentials.
   *
   * @param body - Validated signup data containing email, password, and name information
   * @returns A plain JavaScript object representation of the newly created user
   * @throws HttpError - If user creation fails for any reason
   */
  @Post('/signup')
  @UseBefore(AuthRateLimiter)
  @HttpCode(201)
  @ResponseSchema(SignUpResponse, {
    description: 'User successfully registered',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid input data',
    statusCode: 400,
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Registration failed',
    statusCode: 500,
  })
  @OpenAPI({
    summary: 'Register User',
    description: 'Creates a new user account with the provided credentials.',
  })
  async signup(@Body() body: SignUpBody) {
    const user = await this.authService.signup(body);
    return instanceToPlain(user);
  }

  @Post('/signup/verify')
  @HttpCode(201)
  @ResponseSchema(SignUpResponse, {
    description: 'User successfully verified',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid input data',
    statusCode: 400,
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Registration failed',
    statusCode: 500,
  })
  @OpenAPI({
    summary: 'Verify User',
    description: 'Creates a new user account using the token provided.',
  })
  async verifySignUpProvider(@Body() body: VerifySignUpProviderBody) {
    if (!body.token) {
      throw new CreateError('Token is required');
    }
    const user = await this.authService.verifySignUpProvider(body.token);
    if (!user) {
      throw new CreateError('Failed to verify the user');
    }
    return instanceToPlain(user);
  }

  @Authorized(['admin', 'teacher', 'student'])
  @Patch('/change-password')
  @UseBefore(AuthRateLimiter)
  @ResponseSchema(ChangePasswordResponse, {
    description: 'Password changed successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid password format or mismatch',
    statusCode: 400,
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Password change failed',
    statusCode: 500,
  })
  @OpenAPI({
    summary: 'Change Password',
    description:
      "Changes the authenticated user's password to the new password provided.",
  })
  async changePassword(
    @Body() body: ChangePasswordBody,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      const result = await this.authService.changePassword(body, request.user);
      return {success: true, message: result.message};
    } catch (error) {
      if (error instanceof ChangePasswordError) {
        throw new HttpError(400, error.message);
      }
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
      throw new HttpError(500, 'Internal server error');
    }
  }

  /**
   * Verifies if the user's authentication token is valid.
   * This endpoint is restricted to admin users only.
   * Simply returning a success message confirms the token is valid,
   * as the @Authorized decorator would have rejected the request otherwise.
   *
   * @returns A confirmation object with message indicating the token is valid
   * @throws Automatically rejects unauthorized requests via the @Authorized decorator
   */
  @Authorized(['admin'])
  @Post('/verify')
  @UseBefore(AuthRateLimiter)
  @ResponseSchema(TokenVerificationResponse, {
    description: 'Token verification successful',
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Invalid or expired token',
    statusCode: 401,
  })
  @OpenAPI({
    summary: 'Verify Token',
    description:
      "Verifies if the user's authentication token is valid and belongs to an admin user.",
  })
  async verifyToken() {
    return {
      message: 'Token is valid',
    };
  }
}
