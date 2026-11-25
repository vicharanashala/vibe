import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTodayKey,
  isYesterday,
  loadStreak,
  recordReviewToday,
  clearStreak,
  StreakStorage,
  Clock,
} from './streak';

class MockStorage implements StreakStorage {
  private store = new Map<string, string>();
  public shouldThrowOnSet = false;
  public shouldThrowOnGet = false;

  getItem(key: string): string | null {
    if (this.shouldThrowOnGet) throw new Error('Storage access failed');
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrowOnSet) throw new Error('QuotaExceededError: storage is full');
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    if (this.shouldThrowOnSet) throw new Error('Storage access failed');
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('Spaced Repetition: Student Streak System (streak.ts)', () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  describe('getTodayKey', () => {
    it('formats a date as YYYY-MM-DD in Asia/Kolkata timezone', () => {
      // 2026-08-03 at 18:30:00 UTC is 2026-08-04 00:00:00 in Asia/Kolkata (+05:30)
      const clock: Clock = () => new Date('2026-08-03T18:30:00Z');
      expect(getTodayKey(clock)).toBe('2026-08-04');
    });

    it('stays on the same day when time is early morning in Kolkata', () => {
      const clock: Clock = () => new Date('2026-08-03T02:00:00Z'); // 07:30 IST
      expect(getTodayKey(clock)).toBe('2026-08-03');
    });
  });

  describe('isYesterday', () => {
    it('returns true for consecutive calendar days', () => {
      expect(isYesterday('2026-08-03', '2026-08-04')).toBe(true);
    });

    it('returns true across month boundaries', () => {
      expect(isYesterday('2026-07-31', '2026-08-01')).toBe(true);
    });

    it('returns true across year boundaries', () => {
      expect(isYesterday('2025-12-31', '2026-01-01')).toBe(true);
    });

    it('handles leap years accurately', () => {
      expect(isYesterday('2024-02-28', '2024-02-29')).toBe(true);
      expect(isYesterday('2024-02-29', '2024-03-01')).toBe(true);
    });

    it('returns false for the same day', () => {
      expect(isYesterday('2026-08-03', '2026-08-03')).toBe(false);
    });

    it('returns false when 2 or more days are skipped', () => {
      expect(isYesterday('2026-08-01', '2026-08-03')).toBe(false);
      expect(isYesterday('2026-08-01', '2026-08-10')).toBe(false);
    });

    it('returns false when dates are backwards', () => {
      expect(isYesterday('2026-08-04', '2026-08-03')).toBe(false);
    });
  });

  describe('loadStreak', () => {
    it('returns default zero count when storage is empty', () => {
      const state = loadStreak(storage);
      expect(state).toEqual({ count: 0, lastDate: null });
    });

    it('returns default zero count when storage is null', () => {
      const state = loadStreak(null);
      expect(state).toEqual({ count: 0, lastDate: null });
    });

    it('parses valid saved streak data', () => {
      storage.setItem('vibe_sr_streak_v1', JSON.stringify({ count: 4, lastDate: '2026-08-03' }));
      const state = loadStreak(storage);
      expect(state).toEqual({ count: 4, lastDate: '2026-08-03' });
    });

    it('recovers gracefully from corrupted JSON in storage without throwing', () => {
      storage.setItem('vibe_sr_streak_v1', '{not-valid-json');
      const state = loadStreak(storage);
      expect(state).toEqual({ count: 0, lastDate: null });
    });

    it('handles partially malformed objects gracefully', () => {
      storage.setItem('vibe_sr_streak_v1', JSON.stringify({ count: 'not-a-number' }));
      const state = loadStreak(storage);
      expect(state).toEqual({ count: 0, lastDate: null });
    });
  });

  describe('recordReviewToday', () => {
    it('initializes streak to 1 on the first review ever', () => {
      const clock: Clock = () => new Date('2026-08-01T10:00:00Z');
      const state = recordReviewToday(clock, storage);

      expect(state).toEqual({ count: 1, lastDate: '2026-08-01' });
      expect(loadStreak(storage)).toEqual({ count: 1, lastDate: '2026-08-01' });
    });

    it('does not increment streak if another review occurs on the same day', () => {
      const clockMorning: Clock = () => new Date('2026-08-01T04:00:00Z');
      const clockEvening: Clock = () => new Date('2026-08-01T15:00:00Z');

      recordReviewToday(clockMorning, storage);
      const state = recordReviewToday(clockEvening, storage);

      expect(state).toEqual({ count: 1, lastDate: '2026-08-01' });
    });

    it('increments streak on consecutive review days', () => {
      const day1: Clock = () => new Date('2026-08-01T10:00:00Z');
      const day2: Clock = () => new Date('2026-08-02T10:00:00Z');
      const day3: Clock = () => new Date('2026-08-03T10:00:00Z');

      expect(recordReviewToday(day1, storage).count).toBe(1);
      expect(recordReviewToday(day2, storage).count).toBe(2);
      expect(recordReviewToday(day3, storage).count).toBe(3);
    });

    it('resets streak to 1 when a day is missed', () => {
      const day1: Clock = () => new Date('2026-08-01T10:00:00Z');
      const day2: Clock = () => new Date('2026-08-02T10:00:00Z');
      // Missed August 3rd
      const day4: Clock = () => new Date('2026-08-04T10:00:00Z');

      recordReviewToday(day1, storage);
      recordReviewToday(day2, storage);
      const stateAfterGap = recordReviewToday(day4, storage);

      expect(stateAfterGap).toEqual({ count: 1, lastDate: '2026-08-04' });
    });

    it('fails open when storage throws a QuotaExceededError on set', () => {
      storage.shouldThrowOnSet = true;
      const clock: Clock = () => new Date('2026-08-01T10:00:00Z');

      expect(() => {
        const state = recordReviewToday(clock, storage);
        expect(state.count).toBe(1);
      }).not.toThrow();
    });

    it('computes and returns streak even when storage is null', () => {
      const clock: Clock = () => new Date('2026-08-01T10:00:00Z');
      const state = recordReviewToday(clock, null);
      expect(state).toEqual({ count: 1, lastDate: '2026-08-01' });
    });
  });

  describe('clearStreak', () => {
    it('removes the streak from storage', () => {
      const clock: Clock = () => new Date('2026-08-01T10:00:00Z');
      recordReviewToday(clock, storage);
      expect(loadStreak(storage).count).toBe(1);

      clearStreak(storage);
      expect(loadStreak(storage)).toEqual({ count: 0, lastDate: null });
    });

    it('fails open if storage is null or throws', () => {
      expect(() => clearStreak(null)).not.toThrow();
      storage.shouldThrowOnSet = true;
      expect(() => clearStreak(storage)).not.toThrow();
    });
  });
});
