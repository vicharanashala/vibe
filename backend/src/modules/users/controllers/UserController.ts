import {User} from '#auth/classes/transformers/User.js';
import {UserService} from '#users/services/UserService.js';
import {USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
  Params,
  OnUndefined,
  Req,
  Body,
  Post,
  Patch,
  Authorized,
  UploadedFile,
  BadRequestError,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {EditUserBody, GetUserParams, GetUserResponse, UserNotFoundErrorResponse } from '../classes/validators/UserValidators.js';
import { AUTH_TYPES } from '#root/modules/auth/types.js';
import { IAuthService } from '#root/modules/auth/interfaces/IAuthService.js';
import { avatarUploadOptions } from '../classes/validators/avatarUploadOptions.js';

@OpenAPI({
  tags: ['Users'],
})
@JsonController('/users', {transformResponse: true})
@injectable()
export class UserController {
  constructor(
    @inject(USERS_TYPES.UserService)
    private readonly userService: UserService,
    
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: IAuthService,
  ) {}

  @OpenAPI({
    summary: 'Get user information by user ID',
    description: 'Retrieves user information based on the provided user ID.',
  })
  @Authorized()
  @Get('/:userId')
  @HttpCode(200)
  @ResponseSchema(User, {
    description: 'User information retrieved successfully',
  })
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  async getUserById(
    @Params() params: GetUserParams,
  ): Promise<GetUserResponse> {
    const { userId } = params;
    return await this.userService.getUserById(userId);
  }

  @OpenAPI({
    summary: 'Edit user information',
    description: `Edit user information like first and last name.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Patch('/edit')
  @OnUndefined(200)
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  async editUser(
    @Req() req: any,
    @Body() body: EditUserBody,
  ): Promise<void> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);
    const userId = user._id.toString();
    const firebaseUID = user.firebaseUID;
    await this.userService.editUser(userId, body);
    await this.authService.updateFirebaseUser(firebaseUID, body);
  }

  @OpenAPI({
    summary: 'Update user avatar',
    description: 'Uploads and updates the user profile picture.',
  })
  @Authorized()
  @Patch('/avatar')
  @HttpCode(200)
  async updateAvatar(
    @Req() req: any,
    @UploadedFile('avatar', { options: avatarUploadOptions })
      file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new BadRequestError('No avatar file uploaded. Please ensure you are sending a file with the field name "avatar".');
    }

    try {
      const token = req.headers.authorization?.split(' ')[1];
      const user = await this.authService.getCurrentUserFromToken(token);
      const userId = user._id.toString();

      console.log('User ID for avatar update:', userId);
      console.log('File size:', file.size);

      const avatarUrl = await this.userService.updateAvatar(userId, file.buffer);
      return { avatarUrl };
    } catch (error) {
      console.error('Error in updateAvatar controller:', error);
      throw error;
    }
  }

  @OpenAPI({
    summary: 'Make a user an admin',
    description: `Promotes a user to admin status based on the provided user ID.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/make-admin/:userId')
  @OnUndefined(200)
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  async makeAdmin(
    @Params() params: GetUserParams,
    @Body() body: { password: string }
  ): Promise<void> {
    const { userId } = params;
    await this.userService.makeAdmin(userId, body.password);
  }
}

