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
import {CreateError} from 'shared/errors/errors';

@OpenAPI({
  tags: ['Authentication'],
})
@JsonController('/auth')
@Service()
export class AuthController {
  constructor(
    @Inject('AuthService') private readonly authService: IAuthService,
  ) {}

  @Post('/signup')
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
    if (!user) {
      throw new CreateError('Failed to create the user');
    }
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

  @Authorized(['admin'])
  @Post('/verify')
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
