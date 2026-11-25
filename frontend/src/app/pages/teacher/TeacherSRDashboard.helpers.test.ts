import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatRelativeWhen,
  retentionColor,
  efStripeClass,
} from './TeacherSRDashboard.helpers';

describe('Spaced Repetition: Teacher Dashboard Helpers (TeacherSRDashboard.helpers.ts)', () => {
  describe('formatRelativeWhen', () => {
    const fixedNow = new Date('2026-08-10T12:00:00Z').getTime();

    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns "-" for null, undefined, or empty values', () => {
      expect(formatRelativeWhen(null)).toBe('-');
      expect(formatRelativeWhen(undefined)).toBe('-');
      expect(formatRelativeWhen('')).toBe('-');
    });

    it('returns "-" for unparseable dates', () => {
      expect(formatRelativeWhen('invalid-date-string')).toBe('-');
    });

    it('returns "today" when review is due on the current day', () => {
      const todayIso = new Date('2026-08-10T15:00:00Z').toISOString();
      expect(formatRelativeWhen(todayIso)).toBe('today');
    });

    it('returns "tomorrow" when review is due exactly 1 day in the future', () => {
      const tomorrowIso = new Date('2026-08-11T12:00:00Z').toISOString();
      expect(formatRelativeWhen(tomorrowIso)).toBe('tomorrow');
    });

    it('returns "yesterday" when review was due 1 day in the past', () => {
      const yesterdayIso = new Date('2026-08-09T12:00:00Z').toISOString();
      expect(formatRelativeWhen(yesterdayIso)).toBe('yesterday');
    });

    it('returns "in Xd" for reviews due 2 or more days in the future', () => {
      const in3Days = new Date('2026-08-13T12:00:00Z').toISOString();
      const in10Days = new Date('2026-08-20T12:00:00Z').toISOString();

      expect(formatRelativeWhen(in3Days)).toBe('in 3d');
      expect(formatRelativeWhen(in10Days)).toBe('in 10d');
    });

    it('returns "overdue Xd" for reviews past due by 2 or more days', () => {
      const overdue3Days = new Date('2026-08-07T12:00:00Z').toISOString();
      const overdue7Days = new Date('2026-08-03T12:00:00Z').toISOString();

      expect(formatRelativeWhen(overdue3Days)).toBe('overdue 3d');
      expect(formatRelativeWhen(overdue7Days)).toBe('overdue 7d');
    });
  });

  describe('retentionColor', () => {
    it('returns text-green-600 for EF >= 2.5 (Strong retention)', () => {
      expect(retentionColor(2.5)).toBe('text-green-600');
      expect(retentionColor(2.8)).toBe('text-green-600');
    });

    it('returns text-yellow-600 for 1.8 <= EF < 2.5 (Steady retention)', () => {
      expect(retentionColor(1.8)).toBe('text-yellow-600');
      expect(retentionColor(2.1)).toBe('text-yellow-600');
      expect(retentionColor(2.49)).toBe('text-yellow-600');
    });

    it('returns text-red-600 for EF < 1.8 (Struggling / Needs work)', () => {
      expect(retentionColor(1.79)).toBe('text-red-600');
      expect(retentionColor(1.3)).toBe('text-red-600');
      expect(retentionColor(1.0)).toBe('text-red-600');
    });
  });

  describe('efStripeClass', () => {
    it('returns border-l-emerald-500 for high retention (EF >= 2.5)', () => {
      expect(efStripeClass(2.5)).toBe('border-l-emerald-500');
      expect(efStripeClass(3.0)).toBe('border-l-emerald-500');
    });

    it('returns border-l-amber-500 for medium retention (1.8 <= EF < 2.5)', () => {
      expect(efStripeClass(1.8)).toBe('border-l-amber-500');
      expect(efStripeClass(2.2)).toBe('border-l-amber-500');
    });

    it('returns border-l-rose-500 for low retention (EF < 1.8)', () => {
      expect(efStripeClass(1.79)).toBe('border-l-rose-500');
      expect(efStripeClass(1.3)).toBe('border-l-rose-500');
    });
  });
});
