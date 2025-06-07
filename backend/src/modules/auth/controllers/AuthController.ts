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
import {BadRequestErrorResponse} from '../../../shared/middleware/errorHandler';
import {AuthRateLimiter} from '../../../shared/middleware/rateLimiter';
import {CreateError} from '../../../shared/errors/errors';
import {inject, injectable} from 'inversify';
import TYPES from '../types';

@OpenAPI({
  tags: ['Authentication'],
})
@JsonController('/auth')
@injectable()
export class AuthController {
  constructor(
    @inject(TYPES.AuthService)
    private readonly authService: IAuthService,
  ) {}

  @Post('/signup')
  @UseBefore(AuthRateLimiter)
  @HttpCode(201)
  @OpenAPI({
    summary: 'Sign up a new user',
    description: 'Create a new user account with email and password',
  })
  @ResponseSchema(SignUpResponse, {
    description: 'User signed up successfully',
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Authentication error',
    statusCode: 400,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async signup(@Body() body: SignUpBody) {
    const user = await this.authService.signup(body);
    return instanceToPlain(user);
  }

  @Authorized()
  @Patch('/change-password')
  @UseBefore(AuthRateLimiter)
  @OpenAPI({
    summary: 'Change user password',
    description: 'Change the password for an authenticated user',
  })
  @ResponseSchema(ChangePasswordResponse, {
    description: 'Password changed successfully',
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Authentication error',
    statusCode: 400,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
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

  @Post('/verify')
  @UseBefore(AuthRateLimiter)
  @OpenAPI({
    summary: 'Verify authentication token',
    description: 'Verify that the provided authentication token is valid',
  })
  @ResponseSchema(TokenVerificationResponse, {
    description: 'Token is valid',
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Authentication error',
    statusCode: 400,
  })
  async verifyToken() {
    return {
      message: 'Token is valid',
    };
  }
}
