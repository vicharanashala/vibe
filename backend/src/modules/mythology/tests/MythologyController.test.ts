import { describe, it, expect, beforeEach } from 'vitest';
import { MythologyService } from '../services/MythologyService.js';
import { MythologyController } from '../controllers/MythologyController.js';
import { MythologyRepository } from '../repositories/providers/mongodb/MythologyRepository.js';
import { LeaderboardEntry } from '../types.js';

describe('MythologyController', () => {
  let service: MythologyService;
  let controller: MythologyController;
  let mockEntries: LeaderboardEntry[];

  beforeEach(() => {
    mockEntries = [
      {
        id: 'demo-1',
        name: 'Vikramaditya',
        avatar: '👑',
        streak: 15,
        karma: 450,
        department: 'Computer Science',
        track: 'vibe-typescript',
        lastActive: new Date().toISOString().split('T')[0],
      },
      {
        id: 'demo-2',
        name: 'Anaya Sharma',
        avatar: '🛡️',
        streak: 9,
        karma: 280,
        department: 'Electrical Engineering',
        track: 'vibe-react',
        lastActive: new Date().toISOString().split('T')[0],
      },
    ];

    const mockRepo = {
      upsertEntry: async (entry: Omit<LeaderboardEntry, 'id'>) => {
        const existing = mockEntries.find(e => e.name === entry.name);
        if (existing) {
          existing.streak = Math.max(existing.streak, entry.streak);
          existing.karma = Math.max(existing.karma, entry.karma);
        } else {
          mockEntries.push({ id: `m-${Date.now()}`, ...entry });
        }
      },
      getTopEntries: async () => mockEntries,
    } as unknown as MythologyRepository;

    service = new MythologyService(mockRepo);
    controller = new MythologyController(service);
  });

  it('should return initial leaderboard list', async () => {
    const res = await controller.getLeaderboard();
    expect(res).toHaveProperty('leaderboard');
    expect(Array.isArray(res.leaderboard)).toBe(true);
    expect(res.leaderboard.length).toBeGreaterThanOrEqual(2);
  });

  it('should sync student score to leaderboard', async () => {
    const res = await controller.syncScore({
      name: 'Test Vikram',
      streak: 7,
      karma: 210,
      avatar: '🛡️',
      department: 'CSE',
      track: 'vibe-typescript',
    });

    expect(res.success).toBe(true);
    const updated = res.leaderboard.find(u => u.name === 'Test Vikram');
    expect(updated).toBeDefined();
    expect(updated?.streak).toBe(7);
  });

  it('should process pouch-sync metrics', async () => {
    const res = await controller.syncPouchData({
      currentStreak: 5,
      pouchDocs: [{ timestamp: '2026-08-01T10:00:00.000Z' }],
      indexedMetrics: [],
    });

    expect(res.success).toBe(true);
    expect(res.updatedStreak).toBe(6);
    expect(res.karmaGained).toBe(15);
  });
});
