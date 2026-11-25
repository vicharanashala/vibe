import { describe, it, expect } from 'vitest';
import { filterDueItems } from './spaced-repetition-schedule';
import type { ReviewItem } from '@/types/spaced-repetition.types';

const NOW = new Date('2026-08-05T12:00:00Z').getTime();
const PAST = '2026-08-04T12:00:00Z';
const FUTURE = '2026-08-06T12:00:00Z';

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    course_id: 'course-a',
    question_id: 'q1',
    next_review_at: PAST,
    ...overrides,
  } as ReviewItem;
}

describe('Spaced Repetition: Due-Item Filtering (spaced-repetition-schedule.ts)', () => {
  const schedule = [
    makeItem({ question_id: 'q1', course_id: 'course-a' }),
    makeItem({ question_id: 'q2', course_id: 'course-b' }),
  ];

  it('returns due items from all courses when courseId is missing', () => {
    expect(filterDueItems(schedule, undefined, NOW)).toHaveLength(2);
  });

  it('treats an empty courseId the same as a missing one', () => {
    expect(filterDueItems(schedule, '', NOW)).toHaveLength(2);
  });

  it('returns only the matching course when courseId is set', () => {
    const result = filterDueItems(schedule, 'course-a', NOW);
    expect(result.map(i => i.question_id)).toEqual(['q1']);
  });

  it('returns an empty list when courseId matches no items', () => {
    expect(filterDueItems(schedule, 'course-z', NOW)).toEqual([]);
  });

  it('excludes future, skipped, and opted-out items', () => {
    const items = [
      makeItem({ question_id: 'future', next_review_at: FUTURE }),
      makeItem({ question_id: 'skipped', skipped_at: PAST }),
      makeItem({ question_id: 'optout', notification_opt_out: true }),
      makeItem({ question_id: 'ok' }),
    ];
    expect(filterDueItems(items, undefined, NOW).map(i => i.question_id)).toEqual(['ok']);
  });
});