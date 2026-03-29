import 'reflect-metadata';
import {
  JsonController,
  Get,
  Post,
  HttpCode,
  Params,
  Authorized,
  CurrentUser,
  ForbiddenError,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {OpenAPI} from 'routing-controllers-openapi';
import {ACHIEVEMENTS_TYPES} from '../types.js';
import {AchievementService} from '../services/AchievementService.js';
import {UserIdParams} from '../classes/validators/AchievementValidators.js';
import {
  AchievementsListResponse,
} from '../classes/transformers/Achievement.js';
import {IUser} from '#root/shared/interfaces/models.js';
import {appConfig} from '#root/config/app.js';

@OpenAPI({tags: ['Achievements']})
@JsonController('/achievements', {transformResponse: true})
@injectable()
export class AchievementController {
  constructor(
    @inject(ACHIEVEMENTS_TYPES.AchievementService)
    private readonly achievementService: AchievementService,
  ) {}

  /**
   * GET /achievements
   * Returns all achievement definitions merged with the current user's earned status.
   */
  @Authorized()
  @Get('/')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get all achievements with earned status',
    description:
      'Returns all achievement definitions. Each item includes whether the current user has earned it and when.',
  })
  async getMyAchievements(@CurrentUser() user: IUser) {
    const achievements = await this.achievementService.getAchievementsForUser(
      user._id.toString(),
    );
    return new AchievementsListResponse(achievements as any);
  }

  /**
   * GET /achievements/users/:userId
   * Admin/instructor endpoint — view any user's achievements.
   */
  @Authorized()
  @Get('/users/:userId')
  @HttpCode(200)
  @OpenAPI({
    summary: "Get a user's achievements (admin/instructor)",
    description: "Returns a specific user's earned achievements. Requires admin role or same user.",
  })
  async getUserAchievements(
    @Params() params: UserIdParams,
    @CurrentUser() user: IUser,
  ) {
    if (user.roles !== 'admin' && user._id.toString() !== params.userId) {
      throw new ForbiddenError(
        'You do not have permission to view this user\'s achievements',
      );
    }

    const achievements = await this.achievementService.getAchievementsForUser(
      params.userId,
    );
    return new AchievementsListResponse(achievements as any);
  }

  /**
   * POST /achievements/dev/seed
   * Development only — awards all achievements to the current user for testing.
   */
  @Authorized()
  @Post('/dev/seed')
  @HttpCode(200)
  @OpenAPI({summary: 'Dev only: award all achievements to current user'})
  async devSeed(@CurrentUser() user: IUser) {
    if (appConfig.isProduction || appConfig.isStaging) {
      throw new ForbiddenError('Not available in production');
    }
    await this.achievementService.devSeedForUser(user._id.toString());
    return {message: 'All achievements awarded for testing'};
  }
}
