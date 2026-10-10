import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { courseKeys } from '@/features/courses/queries';
import { api } from '@/lib/api';

export interface DetectorSetting {
  detectorName: string;
  settings: { enabled: boolean };
}

export interface LessonItem {
  _id: string;
  name: string;
  description?: string;
  type: 'VIDEO' | 'BLOG' | 'QUIZ' | 'PROJECT' | 'FEEDBACK' | 'REFLECTION' | 'CASE_STUDY' | string;
  isOptional?: boolean;
  isAlreadyWatched?: boolean;
  /** Resolved server-side: item > module > course setting. */
  proctoringDetectors?: DetectorSetting[];
  details: {
    // VIDEO
    URL?: string;
    source?: 'YOUTUBE' | 'GCS' | null;
    assetId?: string | null;
    startTime?: string;
    endTime?: string;
    // BLOG
    content?: string;
    estimatedReadTimeInMinutes?: number;
    points?: number | string;
  };
}

export interface CourseSettings {
  settings: {
    linearProgressionEnabled?: boolean;
    seekForwardEnabled?: boolean;
    proctors?: { detectors?: DetectorSetting[] };
  };
}

export interface LessonRef {
  courseId: string;
  versionId: string;
  moduleId: string;
  sectionId: string;
  itemId: string;
}

export const learnKeys = {
  item: (r: LessonRef) => ['lesson', r.versionId, r.itemId] as const,
  settings: (courseId: string, versionId: string) => ['course-settings', courseId, versionId] as const,
};

export function isProctored(detectors?: DetectorSetting[]) {
  return (detectors ?? []).some((d) => d.settings?.enabled);
}

/** Detectors this build can actually enforce. Extend as more are ported. */
const SUPPORTED_DETECTORS = new Set([
  'cameraMic',
  'rightClickDisabled',
  'blurDetection',
  'handGestureDetection',
  'voiceDetection',
  'faceCountDetection',
  'faceRecognition',
]);

/** Enabled detectors this build can't enforce yet — a non-empty result means the lesson must stay blocked. */
export function unsupportedDetectors(detectors?: DetectorSetting[]) {
  return (detectors ?? []).filter((d) => d.settings?.enabled && !SUPPORTED_DETECTORS.has(d.detectorName));
}

export function isDetectorEnabled(detectors: DetectorSetting[] | undefined, name: string) {
  return (detectors ?? []).some((d) => d.detectorName === name && d.settings?.enabled);
}

export function useLesson(r: LessonRef) {
  return useQuery({
    queryKey: learnKeys.item(r),
    queryFn: async () =>
      (
        unwrap(
          await api.GET('/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}', {
            params: { path: r },
          }),
        ) as unknown as { item: LessonItem }
      ).item,
    staleTime: 0,
  });
}

export function useCourseSettings(courseId: string, versionId: string) {
  return useQuery({
    queryKey: learnKeys.settings(courseId, versionId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/setting/course-setting/{courseId}/{versionId}', { params: { path: { courseId, versionId } } }),
      ) as unknown as CourseSettings,
  });
}

/** POST …/start — opens a watch-time record for the item and returns its id. */
export async function startItem(r: LessonRef): Promise<string> {
  const data = unwrap(
    await api.POST('/api/users/progress/courses/{courseId}/versions/{versionId}/start', {
      params: { path: { courseId: r.courseId, versionId: r.versionId } },
      body: { itemId: r.itemId, moduleId: r.moduleId, sectionId: r.sectionId },
    }),
  ) as unknown as { watchItemId?: string };
  if (!data?.watchItemId) throw new Error('The lesson could not be started.');
  return data.watchItemId;
}

/** Keeps the watch-time record alive while the student is on the item. */
export async function heartbeat(watchItemId: string, itemId: string) {
  await api.POST('/api/users/watchtime/upsert', { body: { watchItemId, itemId } });
}

/**
 * POST …/stop — closes the watch-time record. The backend validates it (videos
 * need enough watch time) and, if valid, marks the item complete and moves the
 * student's progress pointer to the next item.
 */
export function useCompleteItem(r: LessonRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (watchItemId: string) =>
      unwrap(
        await api.POST('/api/users/progress/courses/{courseId}/versions/{versionId}/stop', {
          params: { path: { courseId: r.courseId, versionId: r.versionId } },
          body: { watchItemId, itemId: r.itemId, moduleId: r.moduleId, sectionId: r.sectionId },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['section-items'] }),
        queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
        queryClient.invalidateQueries({ queryKey: learnKeys.item(r) }),
      ]),
  });
}

export function useSignConsent(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { signature: string; additionalImageConsent: boolean }) =>
      unwrap(
        await api.POST('/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent', {
          params: { path: { courseId, versionId } },
          body: input,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKeys.ethicsConsent(courseId, versionId) }),
  });
}

/** "HH:MM:SS" / "MM:SS" / seconds → seconds. */
export function toSeconds(value?: string | number | null): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  return value
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
}

export function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}
