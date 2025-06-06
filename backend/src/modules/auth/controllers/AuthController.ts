import {SignUpBody, ChangePasswordBody} from '#auth/classes/index.js';
import {
  IAuthService,
  AuthenticatedRequest,
} from '#auth/interfaces/IAuthService.js';
import {ChangePasswordError} from '#auth/services/FirebaseAuthService.js';
import {AuthRateLimiter} from '#shared/index.js';
import {instanceToPlain} from 'class-transformer';
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
} from 'routing-controllers';
import {AUTH_TYPES} from '#auth/types.js';
@JsonController('/auth')
@injectable()
export class AuthController {
  constructor(
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: IAuthService,
  ) {}

  @Post('/signup')
  @UseBefore(AuthRateLimiter)
  @HttpCode(201)
  async signup(@Body() body: SignUpBody) {
    const user = await this.authService.signup(body);
    return instanceToPlain(user);
  }

  @Authorized()
  @Patch('/change-password')
  @UseBefore(AuthRateLimiter)
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
  async verifyToken() {
    return {
      message: 'Token is valid',
    };
  }
}
