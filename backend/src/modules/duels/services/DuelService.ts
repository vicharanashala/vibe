import { BaseService } from '#shared/classes/BaseService.js';
import { injectable, inject } from 'inversify';
import { GLOBAL_TYPES } from '#root/types.js';
import { DUELS_TYPES, IDuel, IDuelRound, IDuelSubmission, DuelStatus, MatchType, IDuelMatchmakingQueue, MatchmakingStatus } from '../types.js';
import { DuelRepository } from '../repositories/DuelRepository.js';
import { HP_SYSTEM_TYPES } from '#root/modules/hpSystem/types.js';
import { LedgerRepository } from '#root/modules/hpSystem/repositories/providers/mongodb/ledgerRepository.js';
import { CohortRepository } from '#root/modules/hpSystem/repositories/providers/mongodb/cohortsRepository.js';
import { QuestionProcessor } from '#quizzes/question-processing/index.js';
import { BadRequestError, NotFoundError, ForbiddenError } from 'routing-controllers';
import { ObjectId, ClientSession, Db } from 'mongodb';
import crypto from 'crypto';

@injectable()
export class DuelService extends BaseService {
  private static readonly FLAT_REWARD_HP = 10;
  private dbInstance: any;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    db: any,
    @inject(DUELS_TYPES.DuelRepository)
    private duelRepository: DuelRepository,
    @inject(HP_SYSTEM_TYPES.ledgerRepository)
    private ledgerRepository: LedgerRepository,
    @inject(HP_SYSTEM_TYPES.cohortRepository)
    private cohortRepository: CohortRepository,
  ) {
    super(db);
    this.dbInstance = db;
  }

  // Retrieve questions scoped to courseId and optional moduleId
  async getScopeQuestions(
    courseId: string,
    moduleId?: string,
  ): Promise<any[]> {
    const db = await this.dbInstance.connect();

    // 1. Fetch active version of the course
    const courseVersion = await db.collection('newCourseVersion').findOne({
      courseId: new ObjectId(courseId),
      versionStatus: 'active',
      isDeleted: { $ne: true },
    });

    if (!courseVersion) {
      throw new NotFoundError('Active course version not found');
    }

    // 2. Find eligible itemsGroupIds based on scope
    let itemsGroupIds: ObjectId[] = [];
    if (moduleId) {
      const module = courseVersion.modules.find(
        (m: any) => m.moduleId?.toString() === moduleId || m._id?.toString() === moduleId
      );
      if (!module) {
        throw new NotFoundError(`Module with ID ${moduleId} not found in this course`);
      }
      module.sections.forEach((sec: any) => {
        if (sec.itemsGroupId) {
          itemsGroupIds.push(new ObjectId(sec.itemsGroupId));
        }
      });
    } else {
      courseVersion.modules.forEach((mod: any) => {
        mod.sections.forEach((sec: any) => {
          if (sec.itemsGroupId) {
            itemsGroupIds.push(new ObjectId(sec.itemsGroupId));
          }
        });
      });
    }

    if (itemsGroupIds.length === 0) {
      return [];
    }

    // 3. Retrieve quizzes from the itemsGroups
    const groups = await db
      .collection('itemsGroup')
      .find({ _id: { $in: itemsGroupIds } })
      .toArray();

    const quizIds: ObjectId[] = [];
    groups.forEach((g: any) => {
      if (g.items) {
        g.items.forEach((item: any) => {
          if (item.type === 'QUIZ' && item._id) {
            quizIds.push(new ObjectId(item._id));
          }
        });
      }
    });

    if (quizIds.length === 0) {
      return [];
    }

    // 4. Retrieve quizzes to collect questionBankRefs
    const quizzes = await db
      .collection('quizzes')
      .find({ _id: { $in: quizIds }, isDeleted: { $ne: true } })
      .toArray();

    const bankIds: ObjectId[] = [];
    quizzes.forEach((q: any) => {
      if (q.details?.questionBankRefs) {
        q.details.questionBankRefs.forEach((ref: any) => {
          if (ref.bankId) {
            bankIds.push(new ObjectId(ref.bankId));
          }
        });
      }
    });

    if (bankIds.length === 0) {
      return [];
    }

    // 5. Retrieve question banks to collect questionIds
    const banks = await db
      .collection('questionBanks')
      .find({ _id: { $in: bankIds }, isDeleted: { $ne: true } })
      .toArray();

    const questionIds: ObjectId[] = [];
    banks.forEach((b: any) => {
      if (b.questions) {
        b.questions.forEach((qId: any) => {
          questionIds.push(new ObjectId(qId));
        });
      }
    });

    if (questionIds.length === 0) {
      return [];
    }

    // 6. Fetch unique, non-deleted SELECT_ONE_IN_LOT questions
    const questions = await db
      .collection('questions')
      .find({
        _id: { $in: questionIds },
        type: 'SELECT_ONE_IN_LOT',
        isDeleted: { $ne: true },
      })
      .toArray();

    // Ensure unique questions by ID string mapping
    const uniqueMap = new Map<string, any>();
    questions.forEach((q: any) => {
      uniqueMap.set(q._id.toString(), q);
    });

    return Array.from(uniqueMap.values());
  }

  // Create a new duel challenge
  async createDuel(
    creatorId: string,
    payload: {
      courseId: string;
      moduleId?: string;
      matchType: 'FRIEND' | 'INVITE_LINK' | 'MATCHMAKING';
      roundCount?: number;
      targetUserId?: string;
      scheduledFor?: string;
    },
  ): Promise<IDuel> {
    const db = await this.dbInstance.connect();
    const roundCount = payload.roundCount ?? 5;

    // Validate matchType dependencies
    if (payload.matchType === 'FRIEND') {
      if (!payload.targetUserId) {
        throw new BadRequestError('targetUserId is required for FRIEND challenges');
      }
      if (payload.targetUserId === creatorId) {
        throw new BadRequestError('You cannot challenge yourself');
      }

      // Check if target user has a valid enrollment in this course
      const targetEnrollment = await db.collection('enrollment').findOne({
        userId: new ObjectId(payload.targetUserId),
        courseId: new ObjectId(payload.courseId),
        isDeleted: { $ne: true },
      });
      if (!targetEnrollment) {
        throw new BadRequestError('The challenged user is not enrolled in this course');
      }
    } else if (payload.matchType === 'MATCHMAKING') {
      if (!payload.targetUserId) {
        throw new BadRequestError('targetUserId is required for MATCHMAKING');
      }
      if (payload.targetUserId === creatorId) {
        throw new BadRequestError('You cannot challenge yourself');
      }
    } else {
      if (payload.scheduledFor) {
        throw new BadRequestError('Invite Link duels cannot be scheduled');
      }
    }

    // Validate scheduledFor if provided
    let scheduledDate: Date | null = null;
    if (payload.scheduledFor) {
      scheduledDate = new Date(payload.scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        throw new BadRequestError('Invalid scheduledFor date format');
      }
      const now = new Date();
      // Abuse prevention: Scheduled duels must be at least 10 minutes in the future
      if (scheduledDate.getTime() < now.getTime() + 10 * 60 * 1000) {
        throw new BadRequestError('Scheduled duels must be scheduled at least 10 minutes in the future');
      }
    }

    // Find and validate question pool size
    const questions = await this.getScopeQuestions(payload.courseId, payload.moduleId);
    if (questions.length < roundCount) {
      throw new BadRequestError(
        `Insufficient questions in this scope (found ${questions.length}, requested ${roundCount})`
      );
    }

    // Shuffle and select rounds questions
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, roundCount);

    const rounds: IDuelRound[] = selectedQuestions.map((q, idx) => ({
      roundNumber: idx + 1,
      isSuddenDeath: false,
      questionId: q._id.toString(),
      submissions: [],
    }));

    // Initialize players list
    const players = [];
    let inviteToken: string | null = null;
    let initialStatus: DuelStatus = 'PENDING';

    if (payload.matchType === 'FRIEND') {
      // Scheduled duel: neither creator nor target has joined yet
      // Immediate duel: creator joins implicitly
      players.push({ userId: creatorId, joinedAt: payload.scheduledFor ? undefined : new Date() });
      players.push({ userId: payload.targetUserId! });
    } else if (payload.matchType === 'MATCHMAKING') {
      players.push({ userId: creatorId, joinedAt: new Date() });
      players.push({ userId: payload.targetUserId!, joinedAt: new Date() });
      initialStatus = 'IN_PROGRESS';
      if (rounds[0]) {
        rounds[0].revealedAt = new Date();
      }
    } else {
      // INVITE_LINK: only creator is present initially
      players.push({ userId: creatorId, joinedAt: new Date() });
      inviteToken = crypto.randomBytes(16).toString('hex');
    }

    const expiryTimeMs = payload.scheduledFor
      ? scheduledDate!.getTime() + 10 * 60 * 1000 // Scheduled duels expire 10 mins after scheduled time
      : Date.now() + 24 * 60 * 60 * 1000; // Immediate duels expire in 24 hours

    const newDuel: IDuel = {
      courseId: payload.courseId,
      moduleId: payload.moduleId || null,
      status: initialStatus,
      matchType: payload.matchType,
      roundCount,
      scheduledFor: scheduledDate,
      createdBy: creatorId,
      players,
      inviteToken,
      rounds,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(expiryTimeMs),
    };

    const insertedId = await this.duelRepository.create(newDuel);
    newDuel._id = insertedId;
    return newDuel;
  }

  // Join or check-in to a duel
  async joinDuel(userId: string, duelId: string, inviteToken?: string): Promise<IDuel> {
    return this._withTransaction(async (session: ClientSession) => {
      const duel = await this.duelRepository.getById(duelId, session);
      if (!duel) {
        throw new NotFoundError('Duel not found');
      }

      if (duel.status !== 'PENDING') {
        throw new BadRequestError(`Cannot join duel with status ${duel.status}`);
      }

      // Check expiry bounds
      if (new Date().getTime() > duel.expiresAt.getTime()) {
        await this.duelRepository.update(duelId, { status: 'EXPIRED', updatedAt: new Date() }, session);
        throw new BadRequestError('This duel challenge has expired');
      }

      const now = new Date();

      if (duel.matchType === 'FRIEND') {
        const playerIndex = duel.players.findIndex(p => p.userId === userId);
        if (playerIndex === -1) {
          throw new ForbiddenError('You are not invited to this duel');
        }

        if (duel.scheduledFor) {
          const scheduledTime = new Date(duel.scheduledFor).getTime();
          const windowStart = scheduledTime - 5 * 60 * 1000;
          const windowEnd = scheduledTime + 10 * 60 * 1000; // 10 minutes grace

          // User joins exact window boundaries in their favor
          if (now.getTime() < windowStart || now.getTime() > windowEnd) {
            throw new BadRequestError('Check-in window is currently closed');
          }
        }

        // Mark player checked in
        duel.players[playerIndex].joinedAt = now;

        // If both players have joined, start the duel
        const allJoined = duel.players.every(p => p.joinedAt !== undefined);
        if (allJoined) {
          duel.status = 'IN_PROGRESS';
          // Initialize first round revealedAt timestamp
          if (duel.rounds[0]) {
            duel.rounds[0].revealedAt = now;
          }
        }
      } else {
        // INVITE_LINK
        if (duel.createdBy === userId) {
          // Creator re-polling/joining
          return duel;
        }

        if (duel.inviteToken !== inviteToken) {
          throw new BadRequestError('Invalid invite token');
        }

        // Add player
        duel.players.push({ userId, joinedAt: now });
        duel.status = 'IN_PROGRESS';
        if (duel.rounds[0]) {
          duel.rounds[0].revealedAt = now;
        }
      }

      duel.updatedAt = now;
      const updated = await this.duelRepository.update(duelId, duel, session);
      return updated!;
    });
  }

  // Get duel state with lazy evaluation of scheduled expiration
  async getDuelState(userId: string, duelId: string): Promise<IDuel> {
    let duel = await this.duelRepository.getById(duelId);
    if (!duel) {
      throw new NotFoundError('Duel not found');
    }

    const isMember = duel.players.some(p => p.userId === userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a participant in this duel');
    }

    // Lazy walkover/no-show resolution check
    const now = new Date();
    if (duel.matchType === 'FRIEND' && duel.scheduledFor && (duel.status === 'PENDING' || duel.status === 'READY')) {
      const scheduledTime = new Date(duel.scheduledFor).getTime();
      const windowEnd = scheduledTime + 10 * 60 * 1000; // 10 mins grace period

      if (now.getTime() > windowEnd) {
        // Evaluate check-ins
        duel = await this._withTransaction(async (session: ClientSession) => {
          return this.resolveExpiredScheduledDuel(duelId, session);
        });
      }
    }

    // Lazy round timeout check for IN_PROGRESS duels
    if (duel.status === 'IN_PROGRESS') {
      const activeRound = duel.rounds.find(r => r.winnerUserId === undefined);
      if (activeRound && activeRound.revealedAt) {
        const age = now.getTime() - new Date(activeRound.revealedAt).getTime();
        if (age > 60 * 1000) {
          duel = await this.checkAndApplyRoundTimeout(duelId);
        }
      }
    }

    return duel;
  }

  async getPendingDuels(userId: string): Promise<IDuel[]> {
    const duels = await this.duelRepository.findPendingForUser(userId);
    const resolvedDuels: IDuel[] = [];

    for (const d of duels) {
      let duel = d;
      const now = new Date();

      // 1. Lazy check for expired scheduled duels
      if (duel.matchType === 'FRIEND' && duel.scheduledFor && (duel.status === 'PENDING' || duel.status === 'READY')) {
        const scheduledTime = new Date(duel.scheduledFor).getTime();
        const windowEnd = scheduledTime + 10 * 60 * 1000;
        if (now.getTime() > windowEnd) {
          duel = await this._withTransaction(async (session: ClientSession) => {
            return this.resolveExpiredScheduledDuel(duel._id!.toString(), session);
          });
        }
      }

      // 2. Lazy check for round timeout
      if (duel.status === 'IN_PROGRESS') {
        const activeRound = duel.rounds.find(r => r.winnerUserId === undefined);
        if (activeRound && activeRound.revealedAt) {
          const age = now.getTime() - new Date(activeRound.revealedAt).getTime();
          if (age > 60 * 1000) {
            duel = await this.checkAndApplyRoundTimeout(duel._id!.toString());
          }
        }
      }

      const stillPending = ['PENDING', 'READY', 'IN_PROGRESS'].includes(duel.status);
      if (stillPending) {
        resolvedDuels.push(duel);
      }
    }

    return resolvedDuels;
  }

  async getHistoryDuels(userId: string, skip: number, limit: number): Promise<[IDuel[], number]> {
    await this.getPendingDuels(userId);

    const [duels, total] = await Promise.all([
      this.duelRepository.findHistoryForUser(userId, skip, limit),
      this.duelRepository.countHistoryForUser(userId),
    ]);
    return [duels, total];
  }

  async checkAndApplyRoundTimeout(duelId: string, session?: ClientSession): Promise<IDuel> {
    const execute = async (sess: ClientSession) => {
      const duel = await this.duelRepository.getById(duelId, sess);
      if (!duel || duel.status !== 'IN_PROGRESS') {
        return duel!;
      }

      const activeRound = duel.rounds.find(r => r.winnerUserId === undefined);
      if (!activeRound || !activeRound.revealedAt) {
        return duel;
      }

      const now = new Date();
      const age = now.getTime() - new Date(activeRound.revealedAt).getTime();
      if (age <= 60 * 1000) {
        return duel;
      }

      // Identify missing players
      const submittedUserIds = activeRound.submissions.map(s => s.userId);
      const missingPlayers = duel.players.filter(p => !submittedUserIds.includes(p.userId));

      if (missingPlayers.length > 0) {
        for (const player of missingPlayers) {
          activeRound.submissions.push({
            userId: player.userId,
            answer: null,
            submittedAt: now,
            isCorrect: false,
            responseTimeMs: 999999,
            autoTimedOut: true,
          } as any);
        }

        await this.scoreRoundAndAdvance(duel, activeRound.roundNumber, sess);
        duel.updatedAt = now;
        const updated = await this.duelRepository.update(duelId, duel, sess);
        return updated!;
      }

      return duel;
    };

    if (session) {
      return execute(session);
    } else {
      return this._withTransaction(execute);
    }
  }

  private async scoreRoundAndAdvance(
    duel: IDuel,
    roundNumber: number,
    session: ClientSession,
  ): Promise<void> {
    const round = duel.rounds.find(r => r.roundNumber === roundNumber);
    if (!round || round.submissions.length !== 2) {
      return;
    }

    const subA = round.submissions[0];
    const subB = round.submissions[1];

    if (subA.isCorrect && subB.isCorrect) {
      if (subA.responseTimeMs < subB.responseTimeMs) {
        round.winnerUserId = subA.userId;
      } else if (subB.responseTimeMs < subA.responseTimeMs) {
        round.winnerUserId = subB.userId;
      } else {
        round.winnerUserId = null;
      }
    } else if (subA.isCorrect) {
      round.winnerUserId = subA.userId;
    } else if (subB.isCorrect) {
      round.winnerUserId = subB.userId;
    } else {
      round.winnerUserId = null;
    }

    const lastRound = duel.rounds[duel.rounds.length - 1];

    if (roundNumber === lastRound.roundNumber) {
      const scores = new Map<string, number>();
      duel.players.forEach(p => scores.set(p.userId, 0));

      duel.rounds.forEach(r => {
        if (r.winnerUserId) {
          scores.set(r.winnerUserId, (scores.get(r.winnerUserId) || 0) + 1);
        }
      });

      const pA = duel.players[0].userId;
      const pB = duel.players[1].userId;
      const scoreA = scores.get(pA) || 0;
      const scoreB = scores.get(pB) || 0;

      if (scoreA === scoreB) {
        const suddenDeathCount = duel.rounds.filter(r => r.isSuddenDeath).length;

        if (suddenDeathCount < 3) {
          const allQuestions = await this.getScopeQuestions(duel.courseId, duel.moduleId || undefined);
          const usedQuestionIds = duel.rounds.map(r => r.questionId);
          const unusedQuestions = allQuestions.filter(q => !usedQuestionIds.includes(q._id.toString()));

          if (unusedQuestions.length > 0) {
            const nextQ = unusedQuestions[Math.floor(Math.random() * unusedQuestions.length)];
            duel.rounds.push({
              roundNumber: roundNumber + 1,
              isSuddenDeath: true,
              questionId: nextQ._id.toString(),
              submissions: [],
              revealedAt: new Date(),
            });
          } else {
            duel.status = 'COMPLETED';
            duel.winnerUserId = null;
            duel.resolutionReason = 'DRAW';
            duel.pointsAwarded = 0;
          }
        } else {
          duel.status = 'COMPLETED';
          duel.winnerUserId = null;
          duel.resolutionReason = 'DRAW';
          duel.pointsAwarded = 0;
        }
      } else {
        const winner = scoreA > scoreB ? pA : pB;
        const loser = winner === pA ? pB : pA;

        duel.status = 'COMPLETED';
        duel.winnerUserId = winner;
        duel.resolutionReason = 'NORMAL';

        const points = await this.awardDuelPoints(winner, loser, duel.courseId, duel._id!.toString(), session);
        duel.pointsAwarded = points;
      }
    } else {
      const nextRound = duel.rounds.find(r => r.roundNumber === roundNumber + 1);
      if (nextRound) {
        nextRound.revealedAt = new Date();
      }
    }
  }

  // Internal routine to resolve an expired scheduled duel
  async resolveExpiredScheduledDuel(duelId: string, session?: ClientSession): Promise<IDuel> {
    const execute = async (sess: ClientSession) => {
      const duel = await this.duelRepository.getById(duelId, sess);
      if (!duel || (duel.status !== 'PENDING' && duel.status !== 'READY')) {
        return duel!;
      }

      const presentPlayers = duel.players.filter(p => p.joinedAt !== undefined);

      if (presentPlayers.length === 1) {
        // 1 player checked in -> WALKOVER win
        const winnerId = presentPlayers[0].userId;
        const loserId = duel.players.find(p => p.userId !== winnerId)!.userId;

        duel.status = 'COMPLETED';
        duel.winnerUserId = winnerId;
        duel.resolutionReason = 'WALKOVER';

        // Transactionally award points
        const points = await this.awardDuelPoints(winnerId, loserId, duel.courseId, duelId, sess);
        duel.pointsAwarded = points;
      } else {
        // 0 players checked in -> MUTUAL_NO_SHOW
        duel.status = 'CANCELLED';
        duel.resolutionReason = 'MUTUAL_NO_SHOW';
        duel.winnerUserId = null;
        duel.pointsAwarded = 0;
      }

      duel.updatedAt = new Date();
      const updated = await this.duelRepository.update(duelId, duel, sess);
      return updated!;
    };

    if (session) {
      return execute(session);
    } else {
      return this._withTransaction(execute);
    }
  }

  // Answer submission
  async submitAnswer(
    userId: string,
    duelId: string,
    roundNumber: number,
    payload: { lotItemId: string; responseTimeMs: number },
  ): Promise<IDuel> {
    return this._withTransaction(async (session: ClientSession) => {
      const db = await this.dbInstance.connect();
      let duel = await this.duelRepository.getById(duelId, session);
      if (!duel) {
        throw new NotFoundError('Duel not found');
      }

      if (duel.status !== 'IN_PROGRESS') {
        throw new BadRequestError('Cannot submit answers; duel is not in progress');
      }

      // Lazy check for timed out round inside this transaction
      const initialActiveRound = duel.rounds.find(r => r.winnerUserId === undefined);
      if (initialActiveRound && initialActiveRound.revealedAt) {
        const now = new Date();
        const age = now.getTime() - new Date(initialActiveRound.revealedAt).getTime();
        if (age > 60 * 1000) {
          await this.checkAndApplyRoundTimeout(duelId, session);
          const reloaded = await this.duelRepository.getById(duelId, session);
          if (!reloaded) {
            throw new NotFoundError('Duel not found');
          }
          duel = reloaded;
          if (duel.status !== 'IN_PROGRESS') {
            throw new BadRequestError('Cannot submit answers; duel is not in progress');
          }
        }
      }

      const player = duel.players.find(p => p.userId === userId);
      if (!player) {
        throw new ForbiddenError('You are not a player in this duel');
      }

      const round = duel.rounds.find(r => r.roundNumber === roundNumber);
      if (!round) {
        throw new BadRequestError(`Round number ${roundNumber} does not exist in this duel`);
      }

      const existingSubmission = round.submissions.find(s => s.userId === userId);
      if (existingSubmission) {
        throw new BadRequestError(`You have already submitted an answer for round ${roundNumber}`);
      }

      // Grade the answer
      const question = await db.collection('questions').findOne(
        { _id: new ObjectId(round.questionId), isDeleted: { $ne: true } },
        { session }
      );
      if (!question) {
        throw new NotFoundError('Round question not found');
      }

      const processor = new QuestionProcessor(question as any);
      // Grader ignores the quiz parameter for SOL type questions
      const feedback = await processor.grade({ lotItemId: payload.lotItemId }, null as any);
      const isCorrect = feedback.status === 'CORRECT';

      round.submissions.push({
        userId,
        answer: { lotItemId: payload.lotItemId },
        submittedAt: new Date(),
        isCorrect,
        responseTimeMs: payload.responseTimeMs,
      });

      // If both players have submitted, score the round
      if (round.submissions.length === 2) {
        await this.scoreRoundAndAdvance(duel, roundNumber, session);
      }

      duel.updatedAt = new Date();
      const updated = await this.duelRepository.update(duelId, duel, session);
      return updated!;
    });
  }

  // Cancel a pending duel (creator only)
  async cancelDuel(userId: string, duelId: string): Promise<IDuel> {
    return this._withTransaction(async (session: ClientSession) => {
      const duel = await this.duelRepository.getById(duelId, session);
      if (!duel) {
        throw new NotFoundError('Duel not found');
      }

      if (duel.createdBy !== userId) {
        throw new ForbiddenError('Only the creator can cancel a pending duel');
      }

      if (duel.status !== 'PENDING') {
        throw new BadRequestError('Can only cancel PENDING duels');
      }

      duel.status = 'CANCELLED';
      duel.updatedAt = new Date();
      const updated = await this.duelRepository.update(duelId, duel, session);
      return updated!;
    });
  }

  // Award points transactionally and handle pair-level cap checks
  private async awardDuelPoints(
    winnerId: string,
    loserId: string,
    courseId: string,
    duelId: string,
    session: ClientSession,
  ): Promise<number> {
    const db = await this.dbInstance.connect();

    // 1. Fetch active version for the course
    const courseVersion = await db.collection('newCourseVersion').findOne(
      { courseId: new ObjectId(courseId), versionStatus: 'active', isDeleted: { $ne: true } },
      { session }
    );
    if (!courseVersion) return 0;

    const courseVersionId = courseVersion._id;

    // 2. Fetch winner enrollment
    const enrollment = await db.collection('enrollment').findOne(
      {
        userId: new ObjectId(winnerId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        isDeleted: { $ne: true },
      },
      { session }
    );
    if (!enrollment) return 0;

    const cohortId = enrollment.cohortId;
    if (!cohortId) return 0;

    // 3. Fetch cohort details
    const cohort = await db.collection('cohorts').findOne({ _id: new ObjectId(cohortId) }, { session });
    const cohortName = cohort?.name || 'Default Cohort';

    // 4. Fetch student details for email
    const studentUser = await db.collection('users').findOne({ _id: new ObjectId(winnerId) }, { session });
    const email = studentUser?.email || '';

    // 5. Enforce Earning Cap
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const dailyWinCount = await this.duelRepository.countDailyWinsBetweenPlayers(
      winnerId,
      loserId,
      startOfTodayUtc,
    );

    const globalDailyWinCount = await this.duelRepository.countDailyPointsAwardedWinsForUser(
      winnerId,
      startOfTodayUtc,
    );

    let pointsToAward = DuelService.FLAT_REWARD_HP;
    let note = `Spurti Duel challenge win. Duel ID: ${duelId}`;

    if (dailyWinCount >= 3) {
      pointsToAward = 0;
      note = `Spurti Duel challenge win (Daily Earning Cap Exceeded). Duel ID: ${duelId}`;
    } else if (globalDailyWinCount >= 5) {
      pointsToAward = 0;
      note = `Spurti Duel challenge win (Global Daily Earning Cap Exceeded). Duel ID: ${duelId}`;
    }

    const currentHp = enrollment.hpPoints ?? 0;

    // 6. Write HP ledger entry
    const ledgerEntry: any = {
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      cohortId: new ObjectId(cohortId),
      cohort: cohortName,
      studentId: new ObjectId(winnerId),
      studentEmail: email,
      activityId: null as any,
      submissionId: null as any,
      eventType: 'AUTO_REWARD',
      direction: 'CREDIT',
      amount: pointsToAward,
      calc: {
        ruleType: 'MANUAL',
        baseHpAtTime: currentHp,
        computedAmount: currentHp + pointsToAward,
        reasonCode: 'SUBMISSION_REWARD',
      },
      links: null,
      meta: {
        triggeredBy: 'SYSTEM_AUTOMATION',
        triggeredByUserId: null,
        note,
      },
    };

    await this.ledgerRepository.create(ledgerEntry, session);

    // 7. Update enrollment balance
    if (pointsToAward > 0) {
      await this.cohortRepository.setHPForEnrollment(
        winnerId,
        courseId,
        courseVersionId.toString(),
        cohortId.toString(),
        currentHp + pointsToAward,
        session,
      );
    }

    return pointsToAward;
  }

  async enqueueUser(userId: string, courseId: string, moduleId?: string): Promise<IDuelMatchmakingQueue> {
    const db = await this.dbInstance.connect();

    // Check if user is enrolled and get their progress
    const enrollment = await db.collection('enrollment').findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      isDeleted: { $ne: true }
    });
    if (!enrollment) {
      throw new BadRequestError('You must be enrolled in this course to join matchmaking');
    }
    const completionPercentage = enrollment.percentCompleted ?? 0;

    const entry: IDuelMatchmakingQueue = {
      userId,
      courseId,
      moduleId: moduleId || null,
      completionPercentage,
      status: 'WAITING',
      queuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes TTL
      matchedDuelId: null
    };

    const insertedId = await this.duelRepository.joinMatchmakingQueue(entry);
    entry._id = insertedId;

    // Run a quick matching sweep for this course/module right away
    await this.performMatchmakingSweep(courseId, moduleId);

    return entry;
  }

  async pollQueueStatus(userId: string): Promise<{
    status: MatchmakingStatus;
    duelId?: string | null;
    waitTimeSeconds: number;
    searchRadiusPercentage: number;
  }> {
    const latestQueue = await this.duelRepository.getMatchmakingQueueStatus(userId);
    if (!latestQueue) {
      throw new NotFoundError('No active matchmaking queue entry found');
    }

    if (latestQueue.status === 'MATCHED' && latestQueue.matchedDuelId) {
      const duel = await this.duelRepository.getById(latestQueue.matchedDuelId);
      if (duel && ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(duel.status)) {
        const db = await this.dbInstance.connect();
        await db.collection('duelMatchmakingQueue').updateOne(
          { _id: new ObjectId(latestQueue._id) },
          { $set: { status: 'EXPIRED' } }
        );
        throw new NotFoundError('No active matchmaking queue entry found');
      }
    }

    if (latestQueue.status === 'WAITING') {
      // Run sweep for this queue's course/module
      await this.performMatchmakingSweep(latestQueue.courseId, latestQueue.moduleId);
      // Re-fetch queue state after sweep
      const updatedQueue = await this.duelRepository.getMatchmakingQueueStatus(userId);
      if (updatedQueue) {
        const now = new Date();
        const waitTimeSeconds = Math.floor((now.getTime() - updatedQueue.queuedAt.getTime()) / 1000);
        const searchRadiusPercentage = this.getSearchRadius(waitTimeSeconds);
        return {
          status: updatedQueue.status,
          duelId: updatedQueue.matchedDuelId,
          waitTimeSeconds,
          searchRadiusPercentage
        };
      }
    }

    const now = new Date();
    const waitTimeSeconds = Math.floor((now.getTime() - latestQueue.queuedAt.getTime()) / 1000);
    const searchRadiusPercentage = this.getSearchRadius(waitTimeSeconds);
    return {
      status: latestQueue.status,
      duelId: latestQueue.matchedDuelId,
      waitTimeSeconds,
      searchRadiusPercentage
    };
  }

  async leaveQueue(userId: string): Promise<boolean> {
    return await this.duelRepository.cancelMatchmakingQueue(userId);
  }

  private getSearchRadius(waitTimeSeconds: number): number {
    if (waitTimeSeconds < 5) return 15;
    if (waitTimeSeconds < 15) return 30;
    if (waitTimeSeconds < 25) return 50;
    return 100;
  }

  async performMatchmakingSweep(courseId?: string, moduleId?: string | null): Promise<number> {
    const db = (await this.dbInstance.connect()) as Db;

    // Find all WAITING queue entries, sorted by queuedAt ASC (longest waiting first)
    const query: any = { status: 'WAITING' };
    if (courseId) {
      query.courseId = courseId;
    }
    if (moduleId !== undefined) {
      query.moduleId = moduleId;
    }

    const waitingEntries = await db.collection<IDuelMatchmakingQueue>('duelMatchmakingQueue')
      .find(query)
      .sort({ queuedAt: 1 })
      .toArray();

    let matchCount = 0;
    const now = new Date();

    for (let i = 0; i < waitingEntries.length; i++) {
      const entryA = waitingEntries[i];

      // Re-check status of entryA in DB to ensure they weren't matched in a previous loop iteration
      const freshA = await db.collection<IDuelMatchmakingQueue>('duelMatchmakingQueue').findOne({
        _id: entryA._id,
        status: 'WAITING'
      });
      if (!freshA) continue;

      const waitTimeA = (now.getTime() - entryA.queuedAt.getTime()) / 1000;
      const radiusA = this.getSearchRadius(waitTimeA);

      // Find candidates B
      const candidates = waitingEntries.filter(entryB => {
        if (entryB.userId === entryA.userId) return false;
        if (entryB.courseId !== entryA.courseId) return false;
        
        const modA = entryA.moduleId ?? null;
        const modB = entryB.moduleId ?? null;
        if (modA !== modB) return false; // exact scope match (null vs undefined normalized)

        const gap = Math.abs(entryA.completionPercentage - entryB.completionPercentage);
        return gap <= radiusA;
      });

      // Filter candidates B to make sure they are still WAITING in DB
      const freshCandidates = [];
      for (const b of candidates) {
        const freshB = await db.collection<IDuelMatchmakingQueue>('duelMatchmakingQueue').findOne({
          _id: b._id,
          status: 'WAITING'
        });
        if (freshB) {
          freshCandidates.push(freshB);
        }
      }

      if (freshCandidates.length === 0) continue;

      // Sort candidates by completion percentage gap (closest first)
      freshCandidates.sort((x, y) => {
        const gapX = Math.abs(entryA.completionPercentage - x.completionPercentage);
        const gapY = Math.abs(entryA.completionPercentage - y.completionPercentage);
        return gapX - gapY;
      });

      const bestCandidateB = freshCandidates[0];

      // We found a match! Create a duel.
      try {
        const duel = await this.createDuel(entryA.userId, {
          courseId: entryA.courseId,
          moduleId: entryA.moduleId || undefined,
          matchType: 'MATCHMAKING',
          targetUserId: bestCandidateB.userId
        });

        // Claim match atomically using transaction in repository
        const claimed = await this.duelRepository.claimMatch(
          entryA._id!.toString(),
          bestCandidateB._id!.toString(),
          duel._id!.toString()
        );

        if (claimed) {
          matchCount++;
          // Remove matched from active loop list
          entryA.status = 'MATCHED';
          bestCandidateB.status = 'MATCHED';
        } else {
          // If transaction failed to lock/claim, we clean up the created duel
          await db.collection('duels').deleteOne({ _id: new ObjectId(duel._id) });
        }
      } catch (err) {
        console.error('Failed to create or claim matchmaking duel:', err);
      }
    }

    return matchCount;
  }
}
