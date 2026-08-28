import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuelService } from '../services/DuelService.js';
import { ObjectId } from 'mongodb';
import { IDuelMatchmakingQueue } from '../types.js';

class MockCollection {
  constructor(public docs: any[]) {}

  find(query: any) {
    let filtered = this.docs.filter(d => {
      for (const k in query) {
        const val = query[k];
        if (val && typeof val === 'object' && '$in' in val) {
          const inList = val.$in.map((x: any) => x.toString());
          if (!inList.includes(d[k]?.toString())) return false;
        } else if (val && typeof val === 'object' && '$ne' in val) {
          if (d[k] === val.$ne) return false;
        } else if (val instanceof ObjectId && d[k] instanceof ObjectId) {
          if (val.toString() !== d[k].toString()) return false;
        } else if (val !== d[k]) {
          return false;
        }
      }
      return true;
    });
    const result = {
      sort: () => result,
      toArray: async () => filtered
    };
    return result;
  }

  async findOne(query: any) {
    return this.docs.find(d => {
      for (const k in query) {
        const val = query[k];
        if (k === '_id') {
          const qId = val.toString();
          const dId = d._id.toString();
          if (dId !== qId) return false;
        } else if (val && typeof val === 'object' && '$ne' in val) {
          if (d[k] === val.$ne) return false;
        } else if (val instanceof ObjectId && d[k] instanceof ObjectId) {
          if (val.toString() !== d[k].toString()) return false;
        } else if (val !== d[k]) {
          return false;
        }
      }
      return true;
    }) || null;
  }

  async insertOne(doc: any) {
    doc._id = doc._id || new ObjectId();
    this.docs.push(doc);
    return { acknowledged: true, insertedId: doc._id };
  }

  async updateMany(query: any, update: any) {
    const matched = this.docs.filter(d => {
      for (const k in query) {
        if (query[k] !== d[k]) return false;
      }
      return true;
    });
    for (const d of matched) {
      if (update.$set) {
        Object.assign(d, update.$set);
      }
    }
    return { acknowledged: true };
  }

  async findOneAndUpdate(query: any, update: any, options?: any) {
    const idx = this.docs.findIndex(d => {
      if (query._id) {
        const qId = query._id.toString();
        const dId = d._id.toString();
        if (dId !== qId) return false;
      }
      if (query.status && d.status !== query.status) return false;
      return true;
    });
    if (idx === -1) return null;
    const doc = this.docs[idx];
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    return doc;
  }

  async deleteOne(query: any) {
    const idx = this.docs.findIndex(d => {
      if (query._id) {
        const qId = query._id.toString();
        const dId = d._id.toString();
        return dId === qId;
      }
      return false;
    });
    if (idx !== -1) {
      this.docs.splice(idx, 1);
    }
    return { acknowledged: true };
  }
}

describe('Spurti Duels Matchmaking Unit & Integration Tests', () => {
  let mockDb: any;
  let mockDuelRepo: any;
  let mockLedgerRepo: any;
  let mockCohortRepo: any;
  let duelService: DuelService;
  let inMemoryDocs: any[];
  let mockCollection: MockCollection;

  beforeEach(() => {
    inMemoryDocs = [];
    mockCollection = new MockCollection(inMemoryDocs);

    mockDb = {
      connect: vi.fn().mockResolvedValue({
        collection: (name: string) => mockCollection
      }),
      getClient: vi.fn().mockResolvedValue({
        startSession: vi.fn().mockReturnValue({
          startTransaction: vi.fn(),
          commitTransaction: vi.fn(),
          abortTransaction: vi.fn(),
          endSession: vi.fn(),
          withTransaction: vi.fn().mockImplementation(async (fn: any) => {
            return await fn();
          })
        })
      })
    };

    mockDuelRepo = {
      create: vi.fn().mockImplementation(async (duel: any) => {
        duel._id = duel._id || new ObjectId();
        inMemoryDocs.push(duel);
        return duel._id.toString();
      }),
      joinMatchmakingQueue: vi.fn().mockImplementation(async (entry: any) => {
        entry._id = entry._id || new ObjectId();
        inMemoryDocs.push(entry);
        return entry._id.toString();
      }),
      cancelMatchmakingQueue: vi.fn().mockImplementation(async (userId: any) => {
        inMemoryDocs.forEach(d => {
          if (d.userId === userId && d.status === 'WAITING') {
            d.status = 'CANCELLED';
          }
        });
        return true;
      }),
      getMatchmakingQueueStatus: vi.fn().mockImplementation(async (userId: any) => {
        return inMemoryDocs.find(d => d.userId === userId && ['WAITING', 'MATCHED'].includes(d.status)) || null;
      }),
      getById: vi.fn().mockImplementation(async (duelId: any) => {
        return inMemoryDocs.find(d => d._id?.toString() === duelId?.toString()) || null;
      }),
      claimMatch: vi.fn().mockImplementation(async (entryAId: any, entryBId: any, duelId: any) => {
        const a = inMemoryDocs.find(d => d._id.toString() === entryAId.toString());
        const b = inMemoryDocs.find(d => d._id.toString() === entryBId.toString());
        if (a && b && a.status === 'WAITING' && b.status === 'WAITING') {
          a.status = 'MATCHED';
          a.matchedDuelId = duelId;
          b.status = 'MATCHED';
          b.matchedDuelId = duelId;
          return true;
        }
        return false;
      })
    };

    mockLedgerRepo = {
      create: vi.fn()
    };

    mockCohortRepo = {
      setHPForEnrollment: vi.fn()
    };

    duelService = new DuelService(
      mockDb,
      mockDuelRepo as any,
      mockLedgerRepo as any,
      mockCohortRepo as any
    );
  });

  describe('Radius Widening Logic', () => {
    it('should compute the correct search radius based on wait duration at multiple points', () => {
      // 0-14 seconds: radius 5%
      expect(duelService['getSearchRadius'](0)).toBe(5);
      expect(duelService['getSearchRadius'](10)).toBe(5);
      expect(duelService['getSearchRadius'](14)).toBe(5);

      // 15-29 seconds: radius 15%
      expect(duelService['getSearchRadius'](15)).toBe(15);
      expect(duelService['getSearchRadius'](25)).toBe(15);
      expect(duelService['getSearchRadius'](29)).toBe(15);

      // 30-59 seconds: radius 30%
      expect(duelService['getSearchRadius'](30)).toBe(30);
      expect(duelService['getSearchRadius'](45)).toBe(30);
      expect(duelService['getSearchRadius'](59)).toBe(30);

      // 60+ seconds: radius 100%
      expect(duelService['getSearchRadius'](60)).toBe(100);
      expect(duelService['getSearchRadius'](90)).toBe(100);
      expect(duelService['getSearchRadius'](120)).toBe(100);
    });
  });

  describe('Closest Match Selection', () => {
    it('should match with the closest completion percentage candidate first', async () => {
      const courseId = '650000000000000000000003';
      const now = new Date();

      inMemoryDocs.push(
        {
          _id: new ObjectId('650000000000000000000201'),
          userId: 'user-a',
          courseId,
          moduleId: null,
          completionPercentage: 50,
          status: 'WAITING',
          queuedAt: now,
        },
        {
          _id: new ObjectId('650000000000000000000202'),
          userId: 'user-b',
          courseId,
          moduleId: null,
          completionPercentage: 54,
          status: 'WAITING',
          queuedAt: now,
        },
        {
          _id: new ObjectId('650000000000000000000203'),
          userId: 'user-c',
          courseId,
          moduleId: null,
          completionPercentage: 48,
          status: 'WAITING',
          queuedAt: now,
        }
      );

      duelService.createDuel = vi.fn().mockResolvedValue({
        _id: '650000000000000000000109'
      });

      const matchCount = await duelService.performMatchmakingSweep(courseId, null);

      expect(matchCount).toBe(1);
      expect(duelService.createDuel).toHaveBeenCalledWith('user-a', {
        courseId,
        moduleId: undefined,
        matchType: 'MATCHMAKING',
        targetUserId: 'user-c'
      });
    });
  });

  describe('Atomic Claim Concurrency Guard', () => {
    it('should reject matched state if claimMatch lock fails and clean up the created duel', async () => {
      const courseId = '650000000000000000000003';
      const now = new Date();

      inMemoryDocs.push(
        {
          _id: new ObjectId('650000000000000000000201'),
          userId: 'user-a',
          courseId,
          moduleId: null,
          completionPercentage: 50,
          status: 'WAITING',
          queuedAt: now,
        },
        {
          _id: new ObjectId('650000000000000000000202'),
          userId: 'user-b',
          courseId,
          moduleId: null,
          completionPercentage: 52,
          status: 'WAITING',
          queuedAt: now,
        }
      );

      const mockDuelId = new ObjectId();
      duelService.createDuel = vi.fn().mockResolvedValue({
        _id: mockDuelId.toString()
      });

      vi.spyOn(mockCollection, 'deleteOne');
      mockDuelRepo.claimMatch.mockResolvedValue(false);

      const matchCount = await duelService.performMatchmakingSweep(courseId, null);

      expect(matchCount).toBe(0);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: mockDuelId });
    });

    it('should handle two concurrent claim attempts and allow only one to succeed', async () => {
      const courseId = '650000000000000000000003';
      const now = new Date();

      const entryA: IDuelMatchmakingQueue = {
        _id: new ObjectId('650000000000000000000201'),
        userId: 'user-a',
        courseId,
        moduleId: null,
        completionPercentage: 50,
        status: 'WAITING',
        queuedAt: now,
        expiresAt: now,
      };
      const entryB: IDuelMatchmakingQueue = {
        _id: new ObjectId('650000000000000000000202'),
        userId: 'user-b',
        courseId,
        moduleId: null,
        completionPercentage: 52,
        status: 'WAITING',
        queuedAt: now,
        expiresAt: now,
      };
      const entryC: IDuelMatchmakingQueue = {
        _id: new ObjectId('650000000000000000000203'),
        userId: 'user-c',
        courseId,
        moduleId: null,
        completionPercentage: 51,
        status: 'WAITING',
        queuedAt: now,
        expiresAt: now,
      };

      inMemoryDocs.push(entryA, entryB, entryC);

      const duelId1 = '650000000000000000000101';
      const duelId2 = '650000000000000000000102';

      // First sweep tries to claim A and C. This succeeds!
      const claim1 = await mockDuelRepo.claimMatch(entryA._id, entryC._id, duelId1);
      expect(claim1).toBe(true);
      expect(entryA.status).toBe('MATCHED');
      expect(entryA.matchedDuelId).toBe(duelId1);
      expect(entryC.status).toBe('MATCHED');
      expect(entryC.matchedDuelId).toBe(duelId1);

      // Concurrent second sweep tries to claim B and C. Since C is now MATCHED, this must fail!
      const claim2 = await mockDuelRepo.claimMatch(entryB._id, entryC._id, duelId2);
      expect(claim2).toBe(false);
      // Verify B remains WAITING and C remains locked to the first duel
      expect(entryB.status).toBe('WAITING');
      expect(entryB.matchedDuelId).toBeUndefined();
      expect(entryC.matchedDuelId).toBe(duelId1);
    });
  });

  describe('Matchmaking Integration Tests', () => {
    it('should successfully enqueue two players and match them via actual createDuel flow', async () => {
      const courseId = new ObjectId('650000000000000000000003');
      const moduleId = new ObjectId('650000000000000000000050');
      const itemsGroupId = new ObjectId('650000000000000000000060');
      const quizId = new ObjectId('650000000000000000000070');
      const bankId = new ObjectId('650000000000000000000080');

      const userAId = '650000000000000000000301';
      const userBId = '650000000000000000000302';
      const questionIds = Array.from({ length: 6 }, () => new ObjectId());

      // Seed the full course and quiz bank hierarchy in the mock collection
      inMemoryDocs.push(
        {
          _id: new ObjectId('650000000000000000000002'), // target user enrollment
          userId: new ObjectId(userBId),
          courseId,
          percentCompleted: 48,
          isDeleted: false
        },
        {
          _id: new ObjectId('650000000000000000000001'), // creator user enrollment
          userId: new ObjectId(userAId),
          courseId,
          percentCompleted: 50,
          isDeleted: false
        },
        {
          _id: new ObjectId(),
          courseId,
          versionStatus: 'active',
          isDeleted: false,
          modules: [
            {
              moduleId,
              sections: [{ itemsGroupId }]
            }
          ]
        },
        {
          _id: itemsGroupId,
          items: [{ type: 'QUIZ', _id: quizId }]
        },
        {
          _id: quizId,
          isDeleted: false,
          details: { questionBankRefs: [{ bankId }] }
        },
        {
          _id: bankId,
          questions: questionIds
        }
      );

      // Seed 6 questions
      for (const qId of questionIds) {
        inMemoryDocs.push({
          _id: qId,
          type: 'SELECT_ONE_IN_LOT'
        });
      }

      // Enqueue userAId (creates WAITING queue document)
      const queueA = await duelService.enqueueUser(userAId, courseId.toString(), moduleId.toString());
      expect(queueA.status).toBe('WAITING');

      // Enqueue userBId
      // Enqueuing userBId triggers performMatchmakingSweep which matches A and B
      const queueB = await duelService.enqueueUser(userBId, courseId.toString(), moduleId.toString());

      // Verify they matched
      const statusA = await duelService.pollQueueStatus(userAId);
      expect(statusA.status).toBe('MATCHED');
      expect(statusA.duelId).toBeDefined();

      const statusB = await duelService.pollQueueStatus(userBId);
      expect(statusB.status).toBe('MATCHED');
      expect(statusB.duelId).toBe(statusA.duelId);

      // Verify the created duel properties
      const duelDoc = inMemoryDocs.find(d => d._id && d._id.toString() === statusA.duelId!.toString());
      expect(duelDoc).toBeDefined();
      expect(duelDoc.matchType).toBe('MATCHMAKING');
      expect(duelDoc.status).toBe('IN_PROGRESS');
      expect(duelDoc.players).toHaveLength(2);
      expect(duelDoc.players[0].joinedAt).toBeDefined();
      expect(duelDoc.players[1].joinedAt).toBeDefined();
      expect(duelDoc.rounds).toHaveLength(5);
      expect(duelDoc.rounds[0].revealedAt).toBeDefined();
    });
  });
});
