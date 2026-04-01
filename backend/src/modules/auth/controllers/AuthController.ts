import {
  SignUpBody,
  ChangePasswordBody,
  LoginBody,
  GoogleSignUpBody,
  SignUpResponse,
  ChangePasswordResponse,
  AuthErrorResponse,
  LoginResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
} from '#auth/classes/validators/AuthValidators.js';
import {
  IAuthService,
  AuthenticatedRequest,
} from '#auth/interfaces/IAuthService.js';
import {ChangePasswordError} from '#auth/services/FirebaseAuthService.js';
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
  Get,
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
    const { recaptchaToken, ...signUpData } = body;

    // Verify reCAPTCHA token
    if (!recaptchaToken) {
      throw new HttpError(400, 'reCAPTCHA verification is required');
    }

    const { verifyRecaptcha } = await import('#root/shared/functions/verifyRecaptcha.js');

    try {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        throw new HttpError(400, 'reCAPTCHA verification failed. Please try again.');
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(500, 'Failed to verify reCAPTCHA. Please try again.');
    }

    const acknowledgedInvites = await this.authService.signup(signUpData as any);
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
    const {email, password, recaptchaToken} = body;

    // Import verifyRecaptcha dynamically to avoid circular dependency
    const { verifyRecaptcha } = await import('#root/shared/functions/verifyRecaptcha.js');

    const isRecaptchaEnabled = process.env.IS_RECAPTCHA_ENABLED === 'true';

    // Verify reCAPTCHA token only when enabled
    if (isRecaptchaEnabled) {
      if (!recaptchaToken) {
        throw new HttpError(400, 'reCAPTCHA verification is required');
      }

      try {
        const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
        if (!isValidRecaptcha) {
          throw new HttpError(400, 'reCAPTCHA verification failed. Please try again.');
        }
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError(500, 'Failed to verify reCAPTCHA. Please try again.');
      }
    }

    if (!appConfig.firebase.apiKey) {
      if (appConfig.isDevelopment) {
        return {
          localId: '',
          email,
          displayName: '',
          idToken: '',
          refreshToken: '',
          expiresIn: 0,
        };
      }

      throw new HttpError(500, 'FIREBASE_API_KEY is not configured');
    }

    // Proceed with Firebase authentication
    try {
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
      const result = await data.json() as any;

      if (!data.ok) {
        throw new HttpError(
          401,
          result?.error?.message || 'Invalid email or password',
        );
      }

      // ✅ fetch your app user from DB
      // const user = await this.authService.getCurrentUserFromToken(result.idToken);
      return result;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(
        500,
        'Firebase login request failed. Check FIREBASE_API_KEY or network connectivity.',
      );
    }
  }

  @OpenAPI({
    summary: 'Request a password reset email',
    description:
      'Sends a password reset email if an account exists. Always returns success to prevent email enumeration.',
  })
  @Post('/forgot-password')
  @HttpCode(200)
  @ResponseSchema(ForgotPasswordResponse, {
    description: 'Password reset email requested',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async forgotPassword(@Body() body: ForgotPasswordBody) {
    const {email, recaptchaToken} = body;
    const { verifyRecaptcha } = await import('#root/shared/functions/verifyRecaptcha.js');

    try {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        throw new HttpError(400, 'reCAPTCHA verification failed. Please try again.');
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to verify reCAPTCHA. Please try again.');
    }

    await this.authService.sendPasswordResetEmail(email);
    return {
      success: true,
      message: 'If an account exists for this email, a reset link has been sent.',
    };
  }

  @OpenAPI({
    summary: 'Resend a password reset email',
    description:
      'Resends a password reset email if an account exists. Always returns success to prevent email enumeration.',
  })
  @Post('/resend-forgot-password')
  @HttpCode(200)
  @ResponseSchema(ForgotPasswordResponse, {
    description: 'Password reset email resent',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async resendForgotPassword(@Body() body: ForgotPasswordBody) {
    const {email, recaptchaToken} = body;
    const { verifyRecaptcha } = await import('#root/shared/functions/verifyRecaptcha.js');

    try {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        throw new HttpError(400, 'reCAPTCHA verification failed. Please try again.');
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to verify reCAPTCHA. Please try again.');
    }

    await this.authService.sendPasswordResetEmail(email);
    return {
      success: true,
      message: 'If an account exists for this email, a reset link has been resent.',
    };
  }

  @OpenAPI({
    summary: 'Get current authenticated user profile',
    description: 'Returns the currently authenticated user from the bearer token.',
  })
  @Authorized()
  @Get('/me')
  @HttpCode(200)
  async me(@Req() req: any) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new HttpError(401, 'Unauthorized');
    }
    return await this.authService.getCurrentUserFromToken(token);
  }
}
