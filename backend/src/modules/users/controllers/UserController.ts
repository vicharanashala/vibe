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
  CurrentUser,
  QueryParam,
  ForbiddenError,
  UseInterceptor,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  ChangeUserEmailBody,
  ChangeUserEmailResponse,
  EditUserBody,
  GetUserParams,
  GetUserResponse,
  UpdateFaceReferenceBody,
  UpdateFaceReferenceHumanBody,
  UserNotFoundErrorResponse,
} from '../classes/validators/UserValidators.js';
import {UserEnrollmentStatisticsResponse} from '../classes/validators/EnrollmentValidators.js';
import {EnrollmentService} from '#users/services/EnrollmentService.js';
import {AUTH_TYPES} from '#root/modules/auth/types.js';
import {ObjectId} from 'mongodb';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {IAuthService} from '#root/modules/auth/interfaces/IAuthService.js';
import {IUser} from '#root/shared/interfaces/models.js';
import {SETTING_TYPES} from '#root/modules/setting/types.js';
import {CourseSettingService} from '#root/modules/setting/services/CourseSettingService.js';
import {ProctoringComponent} from '#root/shared/database/interfaces/ISettingRepository.js';
import {
  resolveProctoringDetectors,
  isDetectorEnabled,
} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {COURSES_TYPES} from '#root/modules/courses/types.js';
import type {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import type {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';

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

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

    @inject(SETTING_TYPES.CourseSettingService)
    private readonly courseSettingService: CourseSettingService,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
  ) {}

  @OpenAPI({
    summary: 'Get user-level enrollment statistics',
    description:
      'Provides aggregated statistics across all courses for the current user.',
  })
  @Authorized()
  @Get('/enrollment-stats')
  @HttpCode(200)
  @ResponseSchema(UserEnrollmentStatisticsResponse, {
    description: 'User-level enrollment statistics',
  })
  async getUserEnrollmentStatistics(
    @CurrentUser({required: true}) user: IUser,
  ): Promise<UserEnrollmentStatisticsResponse> {
    return await this.enrollmentService.getUserEnrollmentStatistics(
      user._id!.toString(),
    );
  }

  @OpenAPI({
    summary: 'Get current user profile',
    description:
      'Retrieves user information for the currently authenticated user.',
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
    summary: 'List all users (admin only)',
    description: 'Fetches every user in the system. Admin only.',
  })
  @Authorized()
  @Get('/')
  @HttpCode(200)
  async listAllUsers(@CurrentUser({required: true}) user: IUser) {
    if (user.roles !== 'admin') {
      throw new ForbiddenError('Only admins can list all users');
    }
    return {users: await this.userService.listAllUsers()};
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
  async getUserById(@Params() params: GetUserParams): Promise<GetUserResponse> {
    const {userId} = params;
    return await this.userService.getUserById(userId);
  }

  @OpenAPI({
    summary: 'Get the current user face reference',
    description:
      'Returns the authenticated user label and stored profile image for face comparison. When courseId and versionId are supplied, the face embedding is only returned if face recognition is enabled -- resolved through the item/module override (moduleId/itemId) when supplied, else the course-wide setting.',
  })
  @Authorized()
  @Get('/me/face-reference')
  @HttpCode(200)
  async getCurrentUserFaceReference(
    @Req() req: any,
    @QueryParam('courseId') courseId?: string,
    @QueryParam('versionId') versionId?: string,
    @QueryParam('moduleId') moduleId?: string,
    @QueryParam('itemId') itemId?: string,
  ): Promise<{
    label: string;
    profileImage: string | null;
    faceEmbedding: number[] | null;
  }> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);

    let faceRecognitionAllowed = true;
    if (courseId && versionId) {
      const [courseSetting, item, courseVersion] = await Promise.all([
        this.courseSettingService.readCourseSettings(courseId, versionId),
        itemId ? this.itemRepo.readItemById(itemId) : null,
        // Only needed to resolve the module's own override -- skip if the
        // client didn't send moduleId (item-level + universal still resolve
        // correctly without it, per resolveProctoringDetectors' precedence).
        moduleId ? this.courseRepo.readVersion(versionId) : null,
      ]);

      const itemModule = moduleId
        ? courseVersion?.modules?.find(m => m.moduleId?.toString() === moduleId)
        : undefined;

      // Resolves the item's/module's own detector override before falling
      // back to the course-wide list, matching AnomalyController's own
      // FACE_RECOGNITION check -- the old course-only lookup here ignored a
      // selective-proctoring override, withholding an already-registered
      // student's embedding (or exposing one that should stay withheld).
      const resolvedDetectors = resolveProctoringDetectors(
        item ?? undefined,
        itemModule,
        courseSetting ?? undefined,
      );
      faceRecognitionAllowed = isDetectorEnabled(
        resolvedDetectors,
        ProctoringComponent.FACERECOGNITION,
      );
    }

    return {
      label:
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      profileImage: user.profileImage || null,
      faceEmbedding: faceRecognitionAllowed ? user.faceEmbedding || null : null,
    };
  }

  @OpenAPI({
    summary: 'Set or replace the current user face reference',
    description:
      'Stores a profile image and 128-length face embedding on the current user. Used when a student adds their face after initial signup.',
  })
  @Authorized()
  @Patch('/me/face-reference')
  @OnUndefined(200)
  async updateCurrentUserFaceReference(
    @Req() req: any,
    @Body({options: {limit: '10mb'}}) body: UpdateFaceReferenceBody,
  ): Promise<void> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);
    await this.userService.updateFaceReference(
      user._id!.toString(),
      body.profileImage,
      body.faceEmbedding,
    );
  }

  @OpenAPI({
    summary: 'Get the current user Human-based face reference (old-vibe only)',
    description:
      'Same as /me/face-reference but reads/writes the separate faceEmbeddingHuman field (1024-length @vladmandic/human embedding) instead of faceEmbedding (128-length, v3). The two never mix.',
  })
  @Authorized()
  @Get('/me/face-reference-human')
  @HttpCode(200)
  async getCurrentUserFaceReferenceHuman(
    @Req() req: any,
    @QueryParam('courseId') courseId?: string,
    @QueryParam('versionId') versionId?: string,
    @QueryParam('moduleId') moduleId?: string,
    @QueryParam('itemId') itemId?: string,
  ): Promise<{
    label: string;
    profileImage: string | null;
    faceEmbedding: number[] | null;
  }> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);

    let faceRecognitionAllowed = true;
    if (courseId && versionId) {
      const [courseSetting, item, courseVersion] = await Promise.all([
        this.courseSettingService.readCourseSettings(courseId, versionId),
        itemId ? this.itemRepo.readItemById(itemId) : null,
        moduleId ? this.courseRepo.readVersion(versionId) : null,
      ]);

      const itemModule = moduleId
        ? courseVersion?.modules?.find(m => m.moduleId?.toString() === moduleId)
        : undefined;

      const resolvedDetectors = resolveProctoringDetectors(
        item ?? undefined,
        itemModule,
        courseSetting ?? undefined,
      );
      faceRecognitionAllowed = isDetectorEnabled(
        resolvedDetectors,
        ProctoringComponent.FACERECOGNITION,
      );
    }

    return {
      label:
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      profileImage: user.profileImage || null,
      faceEmbedding: faceRecognitionAllowed ? user.faceEmbeddingHuman || null : null,
    };
  }

  @OpenAPI({
    summary: 'Set or replace the current user Human-based face reference (old-vibe only)',
    description:
      'Stores a profile image and 1024-length @vladmandic/human face embedding on the current user, in the separate faceEmbeddingHuman field (never faceEmbedding, which is v3/face-api.js-only).',
  })
  @Authorized()
  @Patch('/me/face-reference-human')
  @OnUndefined(200)
  async updateCurrentUserFaceReferenceHuman(
    @Req() req: any,
    @Body({options: {limit: '10mb'}}) body: UpdateFaceReferenceHumanBody,
  ): Promise<void> {
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.authService.getCurrentUserFromToken(token);
    await this.userService.updateFaceReferenceHuman(
      user._id!.toString(),
      body.profileImage,
      body.faceEmbeddingHuman,
    );
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
  async editUser(@Req() req: any, @Body() body: EditUserBody): Promise<void> {
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
    @CurrentUser({required: true}) currentUser: IUser,
    @Params() params: GetUserParams,
  ): Promise<void> {
    const {userId} = params;
    await this.userService.makeAdmin(userId, currentUser);
  }

  @OpenAPI({
    summary: "Change a user's sign-in email (admin)",
    description: `Changes the email a user signs in with, on both their Firebase account and their user record.<br/>
    They keep their password, enrolments and progress. No email is sent.<br/>
    Only an admin may call this endpoint.`,
  })
  @Authorized(['admin'])
  @Patch('/:userId/email')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(ChangeUserEmailResponse, {
    description: 'The new email and the account sign-in methods',
  })
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  async changeUserEmail(
    @Req() req: any,
    @CurrentUser({required: true}) currentUser: IUser,
    @Params() params: GetUserParams,
    @Body() body: ChangeUserEmailBody,
  ): Promise<ChangeUserEmailResponse> {
    const result = await this.userService.changeEmail(
      params.userId,
      body.email,
      currentUser,
    );
    setAuditTrail(req, {
      category: AuditCategory.USER,
      action: AuditAction.USER_EMAIL_CHANGE,
      actor: {
        id: ObjectId.createFromHexString(currentUser._id!.toString()),
        name: `${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}`.trim(),
        email: currentUser.email,
        role: currentUser.roles,
      },
      context: {
        userId: ObjectId.createFromHexString(params.userId),
      },
      changes: {
        before: {email: result.previousEmail},
        after: {email: result.email},
      },
      outcome: {status: OutComeStatus.SUCCESS},
    });
    return result;
  }
}
