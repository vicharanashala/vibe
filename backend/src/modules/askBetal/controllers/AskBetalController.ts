import { JsonController, Post, Get, Body, Authorized, HttpCode, ForbiddenError, UseBefore } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { ASK_BETAL_TYPES } from '../types.js';
import { AskBetalService } from '../services/AskBetalService.js';
import { AskQuestionDto } from '../validators/AskQuestionDto.js';
import { getProgressAbility, ProgressActions } from '#root/modules/users/abilities/progressAbilities.js';
import { Ability } from '#shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';
import { ObjectId } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { createRateLimiter } from '#root/shared/index.js';

const askBetalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per IP
  message: {
    status: 429,
    error: 'Too many queries to Ask Betal. Please wait before asking again.'
  }
});

@JsonController('/ask-betal')
@injectable()
export class AskBetalController {
  constructor(
    @inject(ASK_BETAL_TYPES.AskBetalService)
    private askBetalService: AskBetalService,
    @inject(GLOBAL_TYPES.Database)
    private dbProvider: MongoDatabase,
  ) {}

  @Post('/ask')
  @Authorized()
  @HttpCode(200)
  @UseBefore(askBetalLimiter)
  async ask(
    @Body() payload: AskQuestionDto,
    @Ability(getProgressAbility) { ability, user }: any,
  ) {
    const userId = user._id.toString();

    // 1. Fetch active course version for CASL checking
    const db = await this.dbProvider.connect();
    const versionDoc = await db.collection('newCourseVersion').findOne({
      courseId: new ObjectId(payload.courseId),
      versionStatus: 'active',
      isDeleted: { $ne: true },
    });
    if (!versionDoc) {
      throw new ForbiddenError('Active course version not found');
    }

    const versionId = versionDoc._id.toString();
    const progressResource = subject('Progress', { userId, courseId: payload.courseId, versionId });
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission to access this course');
    }

    return await this.askBetalService.askQuestion(userId, payload);
  }

  @Get('/usage-status')
  @Authorized()
  @HttpCode(200)
  async getUsageStatus() {
    return await this.askBetalService.getUsageStatus();
  }
}
