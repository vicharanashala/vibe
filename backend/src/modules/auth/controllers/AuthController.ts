/**
 * @file AuthController.ts
 * @description Controller managing authentication-related routes.
 *
 * @category Auth/Controllers
 * @categoryDescription
 * Controller for managing authentication-related routes.
 * Handles API endpoints for user signup, password change, and token verification.
 * Uses dependency injection to work with AuthService and exposes endpoints under the `/auth` route.
 */

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
import {ChangePasswordBody, SignUpBody} from '../classes/validators';

/**
 * Controller that handles all authentication-related HTTP endpoints.
 * Exposes routes for user registration, password management, and token verification.
 *
 * @category Auth/Controllers
 */
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
  @HttpCode(201)
  async signup(@Body() body: SignUpBody) {
    const user = await this.authService.signup(body);
    return instanceToPlain(user);
  }

  /**
   * Handles requests to change a user's password.
   * Only accessible to authenticated users with admin, teacher, or student roles.
   *
   * @param body - Contains the new password and confirmation password
   * @param request - The authenticated HTTP request containing the current user
   * @returns A success object with confirmation message upon successful password change
   * @throws HttpError(400) - If password validation fails
   * @throws HttpError(500) - If an unexpected server error occurs
   */
  @Authorized(['admin', 'teacher', 'student'])
  @Patch('/change-password')
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
  async verifyToken() {
    return {
      message: 'Token is valid',
    };
  }
}
