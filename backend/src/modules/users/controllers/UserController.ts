import { User } from '#auth/classes/transformers/User.js';
import { UserService } from '#users/services/UserService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
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
  CurrentUser,
  QueryParam,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import {
  EditUserBody,
  GetUserParams,
  GetUserResponse,
  UpdateFaceReferenceBody,
  UserNotFoundErrorResponse,
} from '../classes/validators/UserValidators.js';
import { UserEnrollmentStatisticsResponse } from '../classes/validators/EnrollmentValidators.js';
import { EnrollmentService } from '#users/services/EnrollmentService.js';
import { AUTH_TYPES } from '#root/modules/auth/types.js';
import { IAuthService } from '#root/modules/auth/interfaces/IAuthService.js';
import { IUser } from '#root/shared/interfaces/models.js';
import { SETTING_TYPES } from '#root/modules/setting/types.js';
import { CourseSettingService } from '#root/modules/setting/services/CourseSettingService.js';
import { ProctoringComponent } from '#root/shared/database/interfaces/ISettingRepository.js';

@OpenAPI({
  tags: ['Users'],
})
@JsonController('/users', { transformResponse: true })
@injectable()
export class UserController {
  constructor(
    @inject(USERS_TYPES.UserService)
    private readonly userService: UserService,

    @inject(AUTH_TYPES.AuthService)
    private readonly authService: IAuthService,

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

    @inject(SETTING_TYPES.CourseSettingService)
    private readonly courseSettingService: CourseSettingService,
  ) { }

  @OpenAPI({
    summary: 'Get user-level enrollment statistics',
    description: 'Provides aggregated statistics across all courses for the current user.',
  })
  @Authorized()
  @Get('/enrollment-stats')
  @HttpCode(200)
  @ResponseSchema(UserEnrollmentStatisticsResponse, {
    description: 'User-level enrollment statistics',
  })
  async getUserEnrollmentStatistics(
    @CurrentUser({ required: true }) user: IUser,
  ): Promise<UserEnrollmentStatisticsResponse> {
    return await this.enrollmentService.getUserEnrollmentStatistics(
      user._id!.toString(),
    );
  }

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
    summary: 'Get current user profile',
    description: 'Retrieves user information for the currently authenticated user.',
  })
  @Authorized()
  @Get('/me')
  @HttpCode(200)
  @ResponseSchema(User, {
    description: 'Current user information retrieved successfully',
  })
  async getCurrentUser(@Req() req: any): Promise<User> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);
    return {
      ...user,
      _id: user._id!.toString(),
    } as User;
  }

  @OpenAPI({
    summary: 'Get the current user face reference',
    description: 'Returns the authenticated user label and stored profile image for face comparison. When courseId and versionId are supplied, the face embedding is only returned if the course has face recognition enabled.',
  })
  @Authorized()
  @Get('/me/face-reference')
  @HttpCode(200)
  async getCurrentUserFaceReference(
    @Req() req: any,
    @QueryParam('courseId') courseId?: string,
    @QueryParam('versionId') versionId?: string,
  ): Promise<{
    label: string;
    profileImage: string | null;
    faceEmbedding: number[] | null;
  }> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);

    let faceRecognitionAllowed = true;
    if (courseId && versionId) {
      const courseSetting = await this.courseSettingService.readCourseSettings(
        courseId,
        versionId,
      );
      const detector = courseSetting?.settings?.proctors?.detectors?.find(
        d => d.detectorName === ProctoringComponent.FACERECOGNITION,
      );
      faceRecognitionAllowed = detector?.settings?.enabled ?? false;
    }

    return {
      label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      profileImage: user.profileImage || null,
      faceEmbedding: faceRecognitionAllowed ? (user.faceEmbedding || null) : null,
    };
  }

  @OpenAPI({
    summary: 'Set or replace the current user face reference',
    description: 'Stores a profile image and 128-length face embedding on the current user. Used when a student adds their face after initial signup.',
  })
  @Authorized()
  @Patch('/me/face-reference')
  @OnUndefined(200)
  async updateCurrentUserFaceReference(
    @Req() req: any,
    @Body({ options: { limit: '10mb' } }) body: UpdateFaceReferenceBody,
  ): Promise<void> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);
    await this.userService.editUser(user._id!.toString(), {
      profileImage: body.profileImage,
      faceEmbedding: body.faceEmbedding,
    });
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
    const userId = user._id!.toString();
    const firebaseUID = user.firebaseUID;
    await this.userService.editUser(userId, body);
    await this.authService.updateFirebaseUser(firebaseUID, body);
  }

  @OpenAPI({
    summary: 'Make a user an admin',
    description: `Promotes a user to admin status based on the provided user ID.<br/>
    Only an existing admin may call this endpoint.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized(['admin'])
  @Post('/make-admin/:userId')
  @OnUndefined(200)
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  async makeAdmin(
    @CurrentUser({ required: true }) currentUser: IUser,
    @Params() params: GetUserParams,
  ): Promise<void> {
    const { userId } = params;
    await this.userService.makeAdmin(userId, currentUser);
  }
}
