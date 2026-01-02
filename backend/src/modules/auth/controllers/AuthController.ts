import {
  SignUpBody,
  ChangePasswordBody,
  LoginBody,
  GoogleSignUpBody,
  SignUpResponse,
  ChangePasswordResponse,
  AuthErrorResponse,
  LoginResponse,
} from '#auth/classes/validators/AuthValidators.js';
import {
  IAuthService,
  AuthenticatedRequest,
} from '#auth/interfaces/IAuthService.js';
import {ChangePasswordError} from '#auth/services/FirebaseAuthService.js';
import {AuthRateLimiter} from '#shared/middleware/rateLimiter.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  UseBefore,
  HttpCode,
  Body,
  Authorized,
  Patch,
  Req,
  HttpError,
  OnUndefined,
} from 'routing-controllers';
import {AUTH_TYPES} from '#auth/types.js';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {appConfig} from '#root/config/app.js';
import {BadRequestErrorResponse} from '#root/shared/index.js';

@OpenAPI({
  tags: ['Authentication'],
})
@JsonController('/auth')
@injectable()
export class AuthController {
  constructor(
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: IAuthService,
  ) {}

  @OpenAPI({
    summary: 'Register a new user account',
    description:
      'Registers a new user using Firebase Authentication and stores additional user details in the application database. This is typically the first step for any new user to access the system.',
  })
  @Post('/signup')
  @HttpCode(201)
  @ResponseSchema(SignUpResponse, {
    description: 'User registered successfully',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Auth Error',
    statusCode: 401,
  })
  async signup(@Body() body: SignUpBody, @Req() req: any) {
    const acknowledgedInvites = await this.authService.signup(body);
    // req.session.userId = acknowledgedInvites;
    if (acknowledgedInvites) {
      return acknowledgedInvites;
    }
  }

  @OpenAPI({
    summary: 'Register a new user account',
    description:
      'Registers a new user using Firebase Authentication and stores additional user details in the application database. This is typically the first step for any new user to access the system.',
  })
  @Post('/signup/google')
  @HttpCode(201)
  @ResponseSchema(SignUpResponse, {
    description: 'User registered successfully',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Auth Error',
    statusCode: 401,
  })
  async googleSignup(@Body() body: GoogleSignUpBody, @Req() req: any) {
    const acknowledgedInvites = await this.authService.googleSignup(
      body,
      req.headers.authorization?.split(' ')[1],
    );
    if (acknowledgedInvites) {
      return acknowledgedInvites;
    }
  }

  @OpenAPI({
    summary: 'Change user password',
    description:
      'Allows an authenticated user to update their password. This action is performed via Firebase Authentication and requires the current credentials to be valid.',
  })
  @Authorized()
  @Patch('/change-password')
  @ResponseSchema(ChangePasswordResponse, {
    description: 'Password changed successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Auth Error',
    statusCode: 401,
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

  @Post('/login')
  @ResponseSchema(LoginResponse, {
    description: 'User logged in successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(AuthErrorResponse, {
    description: 'Auth Error',
    statusCode: 401,
  })
  async login(@Body() body: LoginBody) {
    const {email, password} = body;
    const data = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${appConfig.firebase.apiKey}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    );
    const result = await data.json();

    // ✅ fetch your app user from DB
    // const user = await this.authService.getCurrentUserFromToken(result.idToken);
    return result;
  }
}
