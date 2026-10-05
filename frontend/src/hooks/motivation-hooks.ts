/**
 * Motivation System — TanStack Query hooks.
 *
 * Mirrors `spaced-repetition-hooks.ts`. Three queries + one
 * mutation (Pillar 3 opt-out). All queries fail-open: a thrown
 * fetch returns the empty response.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCourseLeaderboard,
  getCourseMentorView,
  getMyMotivation,
  setOptOut,
} from '../lib/motivation-api';
import {
  LeaderboardResponse,
  MentorViewResponse,
  MotivationMeResponse,
  OptOutResult,
} from '../types/motivation.types';

// ── Query keys ─────────────────────────────────────────────────────────────

/**
 * Centralised query key factory. Pattern matches
 * `spacedRepetitionKeys` so both modules compose well in
 * TanStack Query DevTools.
 */
export const motivationKeys = {
  all: ['motivation'] as const,
  me: (studentId: string) => ['motivation', 'me', studentId] as const,
  leaderboard: (courseId: string, studentId: string) =>
    ['motivation', 'leaderboard', courseId, studentId] as const,
  mentorView: (courseId: string) =>
    ['motivation', 'mentor-view', courseId] as const,
};

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Returns the student's badge progress and status snapshots.
 * Disabled when `studentId` is empty (no auth).
 */
export function useGetMyMotivation(studentId: string) {
  return useQuery<MotivationMeResponse>({
    queryKey: motivationKeys.me(studentId),
    queryFn: () => getMyMotivation(studentId),
    enabled: !!studentId,
  });
}

/**
 * Returns the course-scoped leaderboard. Disabled when either
 * `courseId` or `studentId` is empty — both are required to
 * build the response (the student ID is needed to mark the
 * current user's row).
 */
export function useGetCourseLeaderboard(courseId: string, studentId: string) {
  return useQuery<LeaderboardResponse>({
    queryKey: motivationKeys.leaderboard(courseId, studentId),
    queryFn: () => getCourseLeaderboard(courseId, studentId),
    enabled: !!courseId && !!studentId,
  });
}

/**
 * Returns the mentor view for a course. Disabled when `courseId`
 * is empty. (No student ID required — the mentor is identified
 * by their auth token on the backend.)
 */
export function useGetCourseMentorView(courseId: string) {
  return useQuery<MentorViewResponse>({
    queryKey: motivationKeys.mentorView(courseId),
    queryFn: () => getCourseMentorView(courseId),
    enabled: !!courseId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Pillar 3 opt-out mutation. PATCHes the leaderboard opt-out
 * state for the current student in a given course.
 *
 * Behavior:
 *   - `setOptOut` returns `OptOutResult` (a discriminated union).
 *     We surface `result.ok === false` as a real `error` on the
 *     TanStack mutation — callers can inspect `mutation.error`
 *     to toast the threshold-gate reason string.
 *   - On success (regardless of `changed`), invalidates the
 *     course's leaderboard query so the banner + the rank
 *     re-derive against the persisted state.
 *   - Disabled when either ID is empty — same self-only rule as
 *     the backend.
 *
 * Usage:
 *   const optOut = useSetOptOut();
 *   optOut.mutate({ studentId, courseId, optedOut: true });
 *   if (optOut.error) toast(optOut.error.reason);
 */
export function useSetOptOut() {
  const queryClient = useQueryClient();
  return useMutation<
    OptOutResult,
    Error,
    { studentId: string; courseId: string; optedOut: boolean }
  >({
    mutationFn: ({ studentId, courseId, optedOut }) =>
      setOptOut(studentId, courseId, optedOut),
    onSuccess: (result, vars) => {
      // Promote the `OptOutResult.error` to a thrown Error so
      // callers can read `mutation.error` uniformly.
      if (!result.ok) {
        throw new Error(result.error.reason);
      }
      // Invalidate the affected leaderboard so the banner +
      // rank re-derive on next mount.
      queryClient.invalidateQueries({
        queryKey: motivationKeys.leaderboard(vars.courseId, vars.studentId),
      });
    },
  });
}
