/**
 * Due-item filtering for the student review session.
 *
 * Extracted from `ReviewSession.tsx` so the `?courseId` behavior is
 * unit-testable without rendering the component. A missing `courseId`
 * means "review all courses"; a present one narrows the queue to that
 * course only.
 *
 * Pure function. No React, no side effects.
 */
import type { ReviewItem } from '@/types/spaced-repetition.types';

/**
 * Items eligible for a review session: not opted out of notifications,
 * not skipped, due now or earlier, and (when `targetCourseId` is set)
 * belonging to that course.
 *
 * @param schedule  The student's full review schedule.
 * @param targetCourseId  Value of the `?courseId` search param, if any.
 * @param now  Current time in ms. Injectable for deterministic tests.
 */
export function filterDueItems(
  schedule: ReviewItem[],
  targetCourseId: string | undefined,
  now: number = Date.now(),
): ReviewItem[] {
  return schedule.filter(
    item =>
      !item.notification_opt_out &&
      !item.skipped_at &&
      new Date(item.next_review_at).getTime() <= now &&
      (!targetCourseId || item.course_id === targetCourseId),
  );
}