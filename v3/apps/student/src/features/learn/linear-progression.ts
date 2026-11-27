import type { CourseSettings } from './queries';

/**
 * Whether the course makes strict mode go one lesson at a time. The setting is
 * course-wide (per course version); unset counts as on, as the backend treats it.
 */
export function isLinearCourse(settings: CourseSettings | undefined): boolean {
  return settings?.settings?.linearProgressionEnabled !== false;
}

/**
 * A strict-mode lesson is locked "because it hasn't been reached" only in a
 * linear course, for a lesson that's neither completed nor the student's current
 * one. Instructor content locks are separate and apply either way.
 */
export function isOrderLocked({
  linear,
  alreadyDone,
  itemId,
  currentItemId,
}: {
  linear: boolean;
  alreadyDone: boolean;
  itemId: string;
  currentItemId: string | undefined;
}): boolean {
  return linear && !alreadyDone && !!currentItemId && currentItemId !== itemId;
}
