import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError, ForbiddenError, NotFoundError } from 'routing-controllers';
import { DuelService } from '../services/DuelService.js';
import { ObjectId } from 'mongodb';
import { IDuel } from '../types.js';

function makeService(opts: {
  questionsCount?: number;
  enrollmentExists?: boolean;
  targetEnrollmentExists?: boolean;
  dailyWinCount?: number;
  globalDailyWinCount?: number;
  duelDoc?: any;
} = {}) {
  const {
    questionsCount = 15,
    enrollmentExists = true,
    targetEnrollmentExists = true,
    dailyWinCount = 0,
    globalDailyWinCount = 0,
    duelDoc = null,
  } = opts;

  // Mock Mongo collection responses using valid 24-character hex strings
  const mockDb = {
    connect: vi.fn().mockResolvedValue({
      collection: (name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'newCourseVersion') {
              return {
                _id: new ObjectId('650000000000000000000004'),
                courseId: query.courseId,
                versionStatus: 'active',
                modules: [
                  {
                    moduleId: '650000000000000000000101',
                    sections: [{ itemsGroupId: '650000000000000000000102' }],
                  },
                ],
              };
            }
            if (name === 'enrollment') {
              if (query.userId.toString() === '650000000000000000000002') {
                // target user
                return targetEnrollmentExists ? { _id: '650000000000000000000103', cohortId: '650000000000000000000104', hpPoints: 100 } : null;
              }
              return enrollmentExists ? { _id: '650000000000000000000105', cohortId: '650000000000000000000104', hpPoints: 100 } : null;
            }
            if (name === 'cohorts') {
              return { _id: '650000000000000000000104', name: 'Cohort Alpha' };
            }
            if (name === 'users') {
              return { _id: query._id, email: 'student@vibe.dev' };
            }
            if (name === 'questions') {
              return {
                _id: query._id,
                correctLotItem: { _id: new ObjectId() },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => {
            return {
              toArray: vi.fn().mockResolvedValue(
                name === 'itemsGroup'
                  ? [{ _id: '650000000000000000000102', items: [{ type: 'QUIZ', _id: '650000000000000000000106' }] }]
                  : name === 'quizzes'
                  ? [{ _id: '650000000000000000000106', details: { questionBankRefs: [{ bankId: '650000000000000000000107' }] } }]
                  : name === 'questionBanks'
                  ? [{ _id: '650000000000000000000107', questions: Array.from({ length: questionsCount }, (_, i) => new ObjectId()) }]
                  : name === 'questions'
                  ? Array.from({ length: questionsCount }, (_, i) => ({
                      _id: new ObjectId(),
                      type: 'SELECT_ONE_IN_LOT',
                    }))
                  : []
              ),
            };
          }),
        };
      },
    }),
  };

  const duelRepo = {
    create: vi.fn().mockResolvedValue('650000000000000000000108'),
    getById: vi.fn().mockResolvedValue(duelDoc),
    update: vi.fn().mockImplementation(async (id: any, data: any) => data),
    countDailyWinsBetweenPlayers: vi.fn().mockResolvedValue(dailyWinCount),
    countDailyPointsAwardedWinsForUser: vi.fn().mockResolvedValue(globalDailyWinCount),
    findUnresolvedExpiredScheduledDuels: vi.fn().mockResolvedValue([]),
  };

  const ledgerRepo = {
    create: vi.fn().mockResolvedValue({ acknowledged: true }),
  };

  const cohortRepo = {
    setHPForEnrollment: vi.fn().mockResolvedValue(true),
  };

  const svc = new DuelService(
    mockDb as any,
    duelRepo as any,
    ledgerRepo as any,
    cohortRepo as any,
  );

  // Auto-resolve transaction blocks immediately
  vi.spyOn(svc as any, '_withTransaction').mockImplementation((fn: any) => fn({}));

  return { svc, duelRepo, ledgerRepo, cohortRepo, mockDb };
}

describe('DuelService Unit Tests', () => {
  describe('createDuel validation and question pool size', () => {
    it('creates a FRIEND challenge successfully when sufficient questions exist', async () => {
      const { svc, duelRepo } = makeService({ questionsCount: 10 });

      const result = await svc.createDuel('650000000000000000000001', {
        courseId: '650000000000000000000003',
        matchType: 'FRIEND',
        roundCount: 5,
        targetUserId: '650000000000000000000002',
      });

      expect(result._id).toBe('650000000000000000000108');
      expect(result.roundCount).toBe(5);
      expect(result.rounds.length).toBe(5);
      expect(duelRepo.create).toHaveBeenCalledOnce();
    });

    it('rejects creation when the question pool has insufficient questions for the round count', async () => {
      const { svc } = makeService({ questionsCount: 3 });

      await expect(
        svc.createDuel('650000000000000000000001', {
          courseId: '650000000000000000000003',
          matchType: 'FRIEND',
          roundCount: 5, // 5 rounds requested, only 3 questions in bank
          targetUserId: '650000000000000000000002',
        }),
      ).rejects.toThrowError(/insufficient/i);
    });

    it('rejects scheduled duels set less than 10 minutes in the future', async () => {
      const { svc } = makeService();
      const nearFuture = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes in future

      await expect(
        svc.createDuel('650000000000000000000001', {
          courseId: '650000000000000000000003',
          matchType: 'FRIEND',
          targetUserId: '650000000000000000000002',
          scheduledFor: nearFuture,
        }),
      ).rejects.toThrowError(/scheduled/i);
    });
  });

  describe('scheduled check-in window constraints', () => {
    it('blocks check-in when current time is before the window starts (more than 5 mins before scheduled)', async () => {
      const scheduledTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes in future
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001' },
          { userId: '650000000000000000000002' },
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc } = makeService({ duelDoc });

      await expect(
        svc.joinDuel('650000000000000000000001', '650000000000000000000108'),
      ).rejects.toThrowError(/window/i);
    });

    it('allows check-in when current time is within the window (-5m to +10m)', async () => {
      const scheduledTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes in future (inside window)
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001' },
          { userId: '650000000000000000000002' },
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc } = makeService({ duelDoc });

      const updated = await svc.joinDuel('650000000000000000000001', '650000000000000000000108');
      expect(updated.players[0].joinedAt).toBeDefined();
      expect(updated.status).toBe('PENDING'); // still pending since second player has not joined yet
    });

    it('blocks check-in after the grace window expires (+10m)', async () => {
      const scheduledTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes in past
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001' },
          { userId: '650000000000000000000002' },
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc } = makeService({ duelDoc });

      await expect(
        svc.joinDuel('650000000000000000000001', '650000000000000000000108'),
      ).rejects.toThrowError(/expired|window/i);
    });
  });

  describe('walkover & mutual no-show resolution', () => {
    it('resolves walkover win to the present player if only one checked in', async () => {
      const scheduledTime = new Date(Date.now() - 15 * 60 * 1000); // grace window expired
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() }, // present
          { userId: '650000000000000000000002' }, // absent
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc, cohortRepo, ledgerRepo } = makeService({ duelDoc });

      const resolved = await svc.resolveExpiredScheduledDuel('650000000000000000000108', {} as any);
      expect(resolved.status).toBe('COMPLETED');
      expect(resolved.winnerUserId).toBe('650000000000000000000001');
      expect(resolved.resolutionReason).toBe('WALKOVER');
      expect(cohortRepo.setHPForEnrollment).toHaveBeenCalledOnce();
      expect(ledgerRepo.create).toHaveBeenCalledOnce();
    });

    it('resolves mutual no-show if neither checked in', async () => {
      const scheduledTime = new Date(Date.now() - 15 * 60 * 1000); // grace window expired
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001' }, // absent
          { userId: '650000000000000000000002' }, // absent
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc, cohortRepo, ledgerRepo } = makeService({ duelDoc });

      const resolved = await svc.resolveExpiredScheduledDuel('650000000000000000000108', {} as any);
      expect(resolved.status).toBe('CANCELLED');
      expect(resolved.winnerUserId).toBeNull();
      expect(resolved.resolutionReason).toBe('MUTUAL_NO_SHOW');
      expect(cohortRepo.setHPForEnrollment).not.toHaveBeenCalled();
      expect(ledgerRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('abuse prevention: daily caps', () => {
    it('Scenario 1: awards 10 HP points for the 5th global win, but 0 HP points for the 6th global win', async () => {
      // 5th global win (4 previous wins)
      const scheduledTime = new Date(Date.now() - 15 * 60 * 1000);
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() }, // present
          { userId: '650000000000000000000002' }, // absent
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc: svc5, cohortRepo: cr5 } = makeService({ duelDoc: JSON.parse(JSON.stringify(duelDoc)), globalDailyWinCount: 4 });
      const resolved5 = await svc5.resolveExpiredScheduledDuel('650000000000000000000108', {} as any);
      expect(resolved5.pointsAwarded).toBe(10);
      expect(cr5.setHPForEnrollment).toHaveBeenCalledOnce();

      // 6th global win (5 previous wins)
      const { svc: svc6, cohortRepo: cr6 } = makeService({ duelDoc: JSON.parse(JSON.stringify(duelDoc)), globalDailyWinCount: 5 });
      const resolved6 = await svc6.resolveExpiredScheduledDuel('650000000000000000000108', {} as any);
      expect(resolved6.pointsAwarded).toBe(0);
      expect(cr6.setHPForEnrollment).not.toHaveBeenCalled();
    });

    it('Scenario 2: awards 0 HP points when the pair daily win limit is exceeded (>= 3) even if global count is low', async () => {
      const scheduledTime = new Date(Date.now() - 15 * 60 * 1000);
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() }, // present
          { userId: '650000000000000000000002' }, // absent
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      // Set pair win count to 3, global to 3 (both below global limit of 5)
      const { svc, cohortRepo } = makeService({ duelDoc, dailyWinCount: 3, globalDailyWinCount: 3 });

      const resolved = await svc.resolveExpiredScheduledDuel('650000000000000000000108', {} as any);
      expect(resolved.pointsAwarded).toBe(0);
      expect(cohortRepo.setHPForEnrollment).not.toHaveBeenCalled();
    });

    it('Scenario 3: walkover wins and matchmaking wins both count toward the daily/global caps', async () => {
      // Test Walkover Win under global cap limit
      const scheduledTime = new Date(Date.now() - 15 * 60 * 1000);
      const walkoverDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() }, // present
          { userId: '650000000000000000000002' }, // absent
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc: svcWalkover } = makeService({ duelDoc: walkoverDoc, globalDailyWinCount: 5 });
      const resolvedWalkover = await svcWalkover.resolveExpiredScheduledDuel('650000000000000000000108', {} as any);
      expect(resolvedWalkover.resolutionReason).toBe('WALKOVER');
      expect(resolvedWalkover.pointsAwarded).toBe(0); // walkover blocked by global cap!

      // Test Matchmaking Win under global cap limit
      const matchmakingDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'READY',
        matchType: 'MATCHMAKING',
        roundCount: 1,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc: svcMatchmaking } = makeService({ duelDoc: matchmakingDoc, globalDailyWinCount: 5 });
      // Call awardDuelPoints directly to simulate points award for matchmaking duel
      const points = await svcMatchmaking['awardDuelPoints'](
        '650000000000000000000001',
        '650000000000000000000002',
        '650000000000000000000003',
        '650000000000000000000108',
        undefined as any
      );
      expect(points).toBe(0); // matchmaking blocked by global cap!
    });
  });

  describe('concurrent resolution race safety', () => {
    it('prevents double-resolution and double-awarding of points when resolved concurrently', async () => {
      const scheduledTime = new Date(Date.now() - 15 * 60 * 1000);
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'PENDING',
        matchType: 'FRIEND',
        roundCount: 5,
        scheduledFor: scheduledTime,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() }, // present
          { userId: '650000000000000000000002' }, // absent
        ],
        rounds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(scheduledTime.getTime() + 10 * 60 * 1000),
      };

      const { svc, cohortRepo, ledgerRepo, duelRepo } = makeService({ duelDoc });

      // First call resolves the duel
      const resolved1 = await svc.resolveExpiredScheduledDuel('650000000000000000000108');
      expect(resolved1.status).toBe('COMPLETED');
      expect(resolved1.winnerUserId).toBe('650000000000000000000001');

      // Update mock database state to simulate that the duel status was updated in DB
      duelRepo.getById.mockResolvedValue(resolved1);

      // Second call tries to resolve the same duel
      const resolved2 = await svc.resolveExpiredScheduledDuel('650000000000000000000108');
      
      // Verification
      expect(resolved2.status).toBe('COMPLETED');
      // Repositories should only be called once (during first resolution)
      expect(cohortRepo.setHPForEnrollment).toHaveBeenCalledOnce();
      expect(ledgerRepo.create).toHaveBeenCalledOnce();
    });
  });

  describe('submitAnswer and scoring logic', () => {
    it('awards the round to the faster player if both answer correctly', async () => {
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 1,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          {
            roundNumber: 1,
            isSuddenDeath: false,
            questionId: '6500000000000000000000a1',
            submissions: [],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        };
      });

      // Player 1 submits correct answer (3000ms)
      let state = await svc.submitAnswer('650000000000000000000001', '650000000000000000000108', 1, {
        lotItemId: '650000000000000000000300',
        responseTimeMs: 3000,
      });

      // Player 2 submits correct answer (4000ms)
      state = await svc.submitAnswer('650000000000000000000002', '650000000000000000000108', 1, {
        lotItemId: '650000000000000000000300',
        responseTimeMs: 4000,
      });

      expect(state.status).toBe('COMPLETED');
      expect(state.rounds[0].winnerUserId).toBe('650000000000000000000001'); // player 1 wins round 1 (faster)
      expect(state.winnerUserId).toBe('650000000000000000000001'); // player 1 wins duel
    });

    it('awards the round to the correct player if one is correct and one is incorrect', async () => {
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 1,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          {
            roundNumber: 1,
            isSuddenDeath: false,
            questionId: '6500000000000000000000a1',
            submissions: [],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        };
      });

      // Player 1 incorrect (3000ms)
      let state = await svc.submitAnswer('650000000000000000000001', '650000000000000000000108', 1, {
        lotItemId: 'incorrect_item',
        responseTimeMs: 3000,
      });

      // Player 2 correct (4000ms)
      state = await svc.submitAnswer('650000000000000000000002', '650000000000000000000108', 1, {
        lotItemId: '650000000000000000000300',
        responseTimeMs: 4000,
      });

      expect(state.status).toBe('COMPLETED');
      expect(state.rounds[0].winnerUserId).toBe('650000000000000000000002'); // player 2 wins round 1
      expect(state.winnerUserId).toBe('650000000000000000000002');
    });

    it('results in a draw round if both players are incorrect', async () => {
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 1,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          {
            roundNumber: 1,
            isSuddenDeath: false,
            questionId: '6500000000000000000000a1',
            submissions: [],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'newCourseVersion') {
              return {
                _id: new ObjectId('650000000000000000000004'),
                courseId: query.courseId,
                versionStatus: 'active',
                modules: [
                  {
                    moduleId: '650000000000000000000101',
                    sections: [{ itemsGroupId: '650000000000000000000102' }],
                  },
                ],
              };
            }
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        };
      });

      // Player 1 incorrect
      let state = await svc.submitAnswer('650000000000000000000001', '650000000000000000000108', 1, {
        lotItemId: 'incorrect_item_1',
        responseTimeMs: 3000,
      });

      // Player 2 incorrect
      state = await svc.submitAnswer('650000000000000000000002', '650000000000000000000108', 1, {
        lotItemId: 'incorrect_item_2',
        responseTimeMs: 4000,
      });

      expect(state.status).toBe('COMPLETED');
      expect(state.rounds[0].winnerUserId).toBeNull(); // draw round
      expect(state.winnerUserId).toBeNull(); // draw duel
      expect(state.resolutionReason).toBe('DRAW');
    });

    it('triggers a sudden-death round when score is tied at end of 5 rounds', async () => {
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 5,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          { roundNumber: 1, isSuddenDeath: false, questionId: '6500000000000000000000a1', submissions: [{ userId: 'P1', isCorrect: true, responseTimeMs: 1000 } as any, { userId: 'P2', isCorrect: false } as any], winnerUserId: '650000000000000000000001' },
          { roundNumber: 2, isSuddenDeath: false, questionId: '6500000000000000000000a2', submissions: [{ userId: 'P1', isCorrect: true, responseTimeMs: 1000 } as any, { userId: 'P2', isCorrect: false } as any], winnerUserId: '650000000000000000000001' },
          { roundNumber: 3, isSuddenDeath: false, questionId: '6500000000000000000000a3', submissions: [{ userId: 'P1', isCorrect: false } as any, { userId: 'P2', isCorrect: true, responseTimeMs: 1000 } as any], winnerUserId: '650000000000000000000002' },
          { roundNumber: 4, isSuddenDeath: false, questionId: '6500000000000000000000a4', submissions: [{ userId: 'P1', isCorrect: false } as any, { userId: 'P2', isCorrect: true, responseTimeMs: 1000 } as any], winnerUserId: '650000000000000000000002' },
          { roundNumber: 5, isSuddenDeath: false, questionId: '6500000000000000000000a5', submissions: [], winnerUserId: undefined },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc, questionsCount: 10 });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'newCourseVersion') {
              return {
                _id: new ObjectId('650000000000000000000004'),
                courseId: query.courseId,
                versionStatus: 'active',
                modules: [
                  {
                    moduleId: '650000000000000000000101',
                    sections: [{ itemsGroupId: '650000000000000000000102' }],
                  },
                ],
              };
            }
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue(
              name === 'itemsGroup'
                ? [{ _id: '650000000000000000000102', items: [{ type: 'QUIZ', _id: '650000000000000000000106' }] }]
                : name === 'quizzes'
                ? [{ _id: '650000000000000000000106', details: { questionBankRefs: [{ bankId: '650000000000000000000107' }] } }]
                : name === 'questionBanks'
                ? [{ _id: '650000000000000000000107', questions: [new ObjectId('6500000000000000000000a1'), new ObjectId('6500000000000000000000a2'), new ObjectId('6500000000000000000000a3'), new ObjectId('6500000000000000000000a4'), new ObjectId('6500000000000000000000a5'), new ObjectId('6500000000000000000000a6')] }]
                : name === 'questions'
                ? [
                    { _id: new ObjectId('6500000000000000000000a1'), type: 'SELECT_ONE_IN_LOT' },
                    { _id: new ObjectId('6500000000000000000000a2'), type: 'SELECT_ONE_IN_LOT' },
                    { _id: new ObjectId('6500000000000000000000a3'), type: 'SELECT_ONE_IN_LOT' },
                    { _id: new ObjectId('6500000000000000000000a4'), type: 'SELECT_ONE_IN_LOT' },
                    { _id: new ObjectId('6500000000000000000000a5'), type: 'SELECT_ONE_IN_LOT' },
                    { _id: new ObjectId('6500000000000000000000a6'), type: 'SELECT_ONE_IN_LOT' },
                  ]
                : []
            )
          }))
        };
      });

      let state = await svc.submitAnswer('650000000000000000000001', '650000000000000000000108', 5, {
        lotItemId: 'incorrect_item_1',
        responseTimeMs: 3000,
      });

      state = await svc.submitAnswer('650000000000000000000002', '650000000000000000000108', 5, {
        lotItemId: 'incorrect_item_2',
        responseTimeMs: 4000,
      });

      expect(state.status).toBe('IN_PROGRESS');
      expect(state.rounds.length).toBe(6);
      expect(state.rounds[5].isSuddenDeath).toBe(true);
    });

    it('resolves as DRAW if a tie persists through all 3 sudden-death attempts', async () => {
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 5,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          { roundNumber: 1, isSuddenDeath: false, questionId: '6500000000000000000000a1', submissions: [], winnerUserId: '650000000000000000000001' },
          { roundNumber: 2, isSuddenDeath: false, questionId: '6500000000000000000000a2', submissions: [], winnerUserId: '650000000000000000000001' },
          { roundNumber: 3, isSuddenDeath: false, questionId: '6500000000000000000000a3', submissions: [], winnerUserId: '650000000000000000000002' },
          { roundNumber: 4, isSuddenDeath: false, questionId: '6500000000000000000000a4', submissions: [], winnerUserId: '650000000000000000000002' },
          { roundNumber: 5, isSuddenDeath: false, questionId: '6500000000000000000000a5', submissions: [], winnerUserId: null },
          { roundNumber: 6, isSuddenDeath: true, questionId: '6500000000000000000000a6', submissions: [], winnerUserId: null },
          { roundNumber: 7, isSuddenDeath: true, questionId: '6500000000000000000000a7', submissions: [], winnerUserId: null },
          { roundNumber: 8, isSuddenDeath: true, questionId: '6500000000000000000000a8', submissions: [], winnerUserId: undefined },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        };
      });

      let state = await svc.submitAnswer('650000000000000000000001', '650000000000000000000108', 8, {
        lotItemId: 'incorrect_item_1',
        responseTimeMs: 3000,
      });

      state = await svc.submitAnswer('650000000000000000000002', '650000000000000000000108', 8, {
        lotItemId: 'incorrect_item_2',
        responseTimeMs: 4000,
      });

      expect(state.status).toBe('COMPLETED');
      expect(state.winnerUserId).toBeNull();
      expect(state.resolutionReason).toBe('DRAW');
      expect(state.rounds.length).toBe(8);
    });

    it('falls back to a DRAW if it runs out of unused questions for sudden death', async () => {
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 1,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          { roundNumber: 1, isSuddenDeath: false, questionId: '6500000000000000000000a1', submissions: [], winnerUserId: undefined },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc, questionsCount: 1 });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'newCourseVersion') {
              return {
                _id: new ObjectId('650000000000000000000004'),
                courseId: query.courseId,
                versionStatus: 'active',
                modules: [
                  {
                    moduleId: '650000000000000000000101',
                    sections: [{ itemsGroupId: '650000000000000000000102' }],
                  },
                ],
              };
            }
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue([
              { _id: new ObjectId('6500000000000000000000a1'), type: 'SELECT_ONE_IN_LOT' }
            ])
          }))
        };
      });

      let state = await svc.submitAnswer('650000000000000000000001', '650000000000000000000108', 1, {
        lotItemId: 'incorrect_item_1',
        responseTimeMs: 3000,
      });

      state = await svc.submitAnswer('650000000000000000000002', '650000000000000000000108', 1, {
        lotItemId: 'incorrect_item_2',
        responseTimeMs: 4000,
      });

      expect(state.status).toBe('COMPLETED');
      expect(state.winnerUserId).toBeNull();
      expect(state.resolutionReason).toBe('DRAW');
    });
  });

  describe('round timeout for abandoned duels', () => {
    it('forces round completion and advances when one player has not submitted after 60s timeout', async () => {
      const revealedAt = new Date(Date.now() - 70 * 1000); // 70 seconds ago
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 1,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          {
            roundNumber: 1,
            isSuddenDeath: false,
            questionId: '6500000000000000000000a1',
            submissions: [
              {
                userId: '650000000000000000000001',
                answer: { lotItemId: 'item_1' },
                submittedAt: new Date(),
                isCorrect: true,
                responseTimeMs: 3000
              }
            ],
            revealedAt,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        };
      });

      // Query getDuelState which triggers lazy round timeout evaluation
      const state = await svc.getDuelState('650000000000000000000001', '650000000000000000000108');

      expect(state.status).toBe('COMPLETED');
      expect(state.rounds[0].submissions.length).toBe(2);
      
      const timedOutSub = state.rounds[0].submissions.find(s => s.userId === '650000000000000000000002');
      expect(timedOutSub).toBeDefined();
      expect(timedOutSub!.isCorrect).toBe(false);
      expect(timedOutSub!.answer).toBeNull();
      expect((timedOutSub as any).autoTimedOut).toBe(true);

      expect(state.rounds[0].winnerUserId).toBe('650000000000000000000001'); // present player wins round
      expect(state.winnerUserId).toBe('650000000000000000000001'); // present player wins duel
    });

    it('defends against concurrent race conditions during timeout resolution', async () => {
      const revealedAt = new Date(Date.now() - 70 * 1000); // 70 seconds ago
      const duelDoc: IDuel = {
        _id: '650000000000000000000108',
        courseId: '650000000000000000000003',
        status: 'IN_PROGRESS',
        matchType: 'FRIEND',
        roundCount: 1,
        createdBy: '650000000000000000000001',
        players: [
          { userId: '650000000000000000000001', joinedAt: new Date() },
          { userId: '650000000000000000000002', joinedAt: new Date() },
        ],
        rounds: [
          {
            roundNumber: 1,
            isSuddenDeath: false,
            questionId: '6500000000000000000000a1',
            submissions: [],
            revealedAt,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const { svc, mockDb } = makeService({ duelDoc });

      const db = await mockDb.connect();
      db.collection = vi.fn().mockImplementation((name: string) => {
        return {
          findOne: vi.fn().mockImplementation(async (query: any) => {
            if (name === 'newCourseVersion') {
              return {
                _id: new ObjectId('650000000000000000000004'),
                courseId: query.courseId,
                versionStatus: 'active',
                modules: [
                  {
                    moduleId: '650000000000000000000101',
                    sections: [{ itemsGroupId: '650000000000000000000102' }],
                  },
                ],
              };
            }
            if (name === 'questions') {
              return {
                _id: query._id,
                type: 'SELECT_ONE_IN_LOT',
                correctLotItem: { _id: new ObjectId('650000000000000000000300') },
                points: 5,
              };
            }
            return null;
          }),
          find: vi.fn().mockImplementation(() => ({
            toArray: vi.fn().mockResolvedValue([])
          }))
        };
      });

      // Simulate a concurrent race condition by triggering timeout first, advancing duel
      await svc.checkAndApplyRoundTimeout('650000000000000000000108');

      // Now student 1 tries to submit answer for the timed out round 1
      await expect(
        svc.submitAnswer('650000000000000000000001', '650000000000000000000108', 1, {
          lotItemId: '650000000000000000000300',
          responseTimeMs: 2000
        })
      ).rejects.toThrow("Cannot submit answers; duel is not in progress");
    });
  });
});
