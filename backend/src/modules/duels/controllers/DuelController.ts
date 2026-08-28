import { JsonController, Post, Get, Delete, Body, Params, Param, QueryParams, Authorized, Req, HttpCode, ForbiddenError } from 'routing-controllers';
import { inject } from 'inversify';
import { DUELS_TYPES, IDuel } from '../types.js';
import { DuelService } from '../services/DuelService.js';
import { CreateDuelDto } from '../validators/CreateDuelDto.js';
import { JoinDuelDto } from '../validators/JoinDuelDto.js';
import { SubmitAnswerDto } from '../validators/SubmitAnswerDto.js';
import { JoinMatchmakingQueueDto } from '../validators/JoinMatchmakingQueueDto.js';
import { getProgressAbility, ProgressActions } from '#root/modules/users/abilities/progressAbilities.js';
import { Ability } from '#shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';
import { ObjectId } from 'mongodb';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';

export class DuelHistoryQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}

@JsonController('/duels', { transformResponse: true })
export class DuelController {
  constructor(
    @inject(DUELS_TYPES.DuelService)
    private duelService: DuelService,
    @inject(GLOBAL_TYPES.Database)
    private dbProvider: MongoDatabase,
  ) {}

  // Create a duel
  @Post('/')
  @Authorized()
  @HttpCode(201)
  async create(
    @Body() payload: CreateDuelDto,
    @Ability(getProgressAbility) { ability, user }: any,
  ) {
    const userId = user._id.toString();

    // Fetch active course version for CASL checking
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

    return await this.duelService.createDuel(userId, payload);
  }

  // Join/Check-in to a duel
  @Post('/:id/join')
  @Authorized()
  @HttpCode(200)
  async join(
    @Param('id') id: string,
    @Body() payload: JoinDuelDto,
    @Ability(getProgressAbility) { ability, user }: any,
  ) {
    const userId = user._id.toString();
    const duel = await this.duelService.getDuelState(userId, id);

    // Enforce course enrollment
    const db = await this.dbProvider.connect();
    const versionDoc = await db.collection('newCourseVersion').findOne({
      courseId: new ObjectId(duel.courseId),
      versionStatus: 'active',
      isDeleted: { $ne: true },
    });
    const versionId = versionDoc?._id?.toString() || '';

    const progressResource = subject('Progress', { userId, courseId: duel.courseId, versionId });
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission to access this course');
    }

    return await this.duelService.joinDuel(userId, id, payload.inviteToken);
  }

  // Paginated past duels for the current user
  @Get('/history')
  @Authorized()
  @HttpCode(200)
  async getHistory(
    @QueryParams() query: DuelHistoryQuery,
    @Ability(getProgressAbility) { user }: any,
  ) {
    const userId = user._id.toString();
    const skip = (query.page - 1) * query.limit;
    const [duels, total] = await this.duelService.getHistoryDuels(userId, skip, query.limit);

    return {
      data: duels,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  // List pending invitations for current user
  @Get('/pending')
  @Authorized()
  @HttpCode(200)
  async getPending(
    @Ability(getProgressAbility) { user }: any,
  ) {
    const userId = user._id.toString();
    return await this.duelService.getPendingDuels(userId);
  }

  // Join matchmaking queue
  @Post('/matchmaking/queue')
  @Authorized()
  @HttpCode(201)
  async joinMatchmaking(
    @Body() payload: JoinMatchmakingQueueDto,
    @Ability(getProgressAbility) { ability, user }: any,
  ) {
    const userId = user._id.toString();

    // Fetch active course version for CASL checking
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

    return await this.duelService.enqueueUser(userId, payload.courseId, payload.moduleId);
  }

  // Poll matchmaking status
  @Get('/matchmaking/status')
  @Authorized()
  @HttpCode(200)
  async getMatchmakingStatus(
    @Ability(getProgressAbility) { user }: any,
  ) {
    const userId = user._id.toString();
    return await this.duelService.pollQueueStatus(userId);
  }

  // Leave matchmaking queue
  @Delete('/matchmaking/queue')
  @Authorized()
  @HttpCode(200)
  async leaveMatchmaking(
    @Ability(getProgressAbility) { user }: any,
  ) {
    const userId = user._id.toString();
    const success = await this.duelService.leaveQueue(userId);
    return { success };
  }

  // Poll state (supports lazy resolution)
  @Get('/:id')
  @Authorized()
  @HttpCode(200)
  async getOne(
    @Param('id') id: string,
    @Ability(getProgressAbility) { ability, user }: any,
  ) {
    const userId = user._id.toString();
    return await this.duelService.getDuelState(userId, id);
  }

  // Submit round answer
  @Post('/:id/rounds/:roundNumber/answer')
  @Authorized()
  @HttpCode(200)
  async submitAnswer(
    @Param('id') id: string,
    @Param('roundNumber') roundNumber: number,
    @Body() payload: SubmitAnswerDto,
    @Ability(getProgressAbility) { ability, user }: any,
  ) {
    const userId = user._id.toString();
    const duel = await this.duelService.getDuelState(userId, id);

    // Enforce course enrollment
    const db = await this.dbProvider.connect();
    const versionDoc = await db.collection('newCourseVersion').findOne({
      courseId: new ObjectId(duel.courseId),
      versionStatus: 'active',
      isDeleted: { $ne: true },
    });
    const versionId = versionDoc?._id?.toString() || '';

    const progressResource = subject('Progress', { userId, courseId: duel.courseId, versionId });
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission to access this course');
    }

    return await this.duelService.submitAnswer(userId, id, Number(roundNumber), payload);
  }

  // Cancel a pending duel
  @Post('/:id/cancel')
  @Authorized()
  @HttpCode(200)
  async cancel(
    @Param('id') id: string,
    @Ability(getProgressAbility) { ability, user }: any,
  ) {
    const userId = user._id.toString();
    return await this.duelService.cancelDuel(userId, id);
  }
}
