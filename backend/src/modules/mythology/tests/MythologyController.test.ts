import { describe, it, expect, beforeEach } from 'vitest';
import { MythologyService } from '../services/MythologyService.js';
import { MythologyController } from '../controllers/MythologyController.js';

describe('MythologyController', () => {
  let service: MythologyService;
  let controller: MythologyController;

  beforeEach(() => {
    service = new MythologyService();
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
