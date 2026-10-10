import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';
import { toId } from '@/features/learn/quiz-api';
import { courseKeys } from '@/features/courses/queries';
import { learnKeys, type DetectorSetting } from '@/features/learn/queries';

/** Shape follows what GET /users/me actually returns (same fields as the Mongo user doc). */
export interface CurrentUserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName?: string;
  roles: 'admin' | 'user';
}

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => unwrap(await api.GET('/api/users/me', {})) as unknown as CurrentUserProfile,
    staleTime: 5 * 60 * 1000,
  });
}

/** The backend serialises _id/versions as raw BSON buffers here (see toId's doc comment). */
export interface AdminCourse {
  _id: string;
  name: string;
  description: string;
  versions: string[];
  instructors: string[];
  createdAt: string;
}

export function useAllCourses() {
  return useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: async () => {
      const raw = unwrap(await api.GET('/api/courses/', {})) as unknown as { courses: any[] };
      return raw.courses.map((c) => ({
        _id: toId(c._id),
        name: c.name,
        description: c.description,
        versions: (c.versions ?? []).map(toId),
        instructors: (c.instructors ?? []).map(toId),
        createdAt: c.createdAt,
      })) as AdminCourse[];
    },
  });
}

export interface CreateCourseInput {
  name: string;
  description: string;
  versionName: string;
  versionDescription: string;
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCourseInput) =>
      unwrap(
        await api.POST('/api/courses/', {
          // The spec marks these required; they are optional in the backend and
          // these are its documented defaults (no HP system, base HP 0).
          body: { ...input, hpSystem: false, baseHp: 0 },
        }),
      ) as unknown as { _id: string; versions: string[] },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
  });
}

export interface InviteUserInput {
  courseId: string;
  versionId: string;
  email: string;
  role: 'STUDENT' | 'INSTRUCTOR';
}

export function useInviteUser() {
  return useMutation({
    mutationFn: async ({ courseId, versionId, email, role }: InviteUserInput) =>
      unwrap(
        await api.POST('/api/notifications/invite/courses/{courseId}/versions/{versionId}', {
          params: { path: { courseId, versionId } },
          body: { inviteData: [{ email, role }] },
        }),
      ) as unknown as { invites: { inviteId: string; email: string; inviteStatus: string }[] },
  });
}

function invalidateVersion(queryClient: ReturnType<typeof useQueryClient>, versionId: string) {
  void queryClient.invalidateQueries({ queryKey: courseKeys.version(versionId) });
}

// ---- Modules ----

export function useCreateModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, name, description }: { versionId: string; name: string; description: string }) =>
      unwrap(
        await api.POST('/api/courses/versions/{versionId}/modules', {
          params: { path: { versionId } },
          body: { name, description },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      moduleId,
      name,
      description,
    }: { versionId: string; moduleId: string; name: string; description: string }) =>
      unwrap(
        await api.PUT('/api/courses/versions/{versionId}/modules/{moduleId}', {
          params: { path: { versionId, moduleId } },
          body: { name, description },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

export function useDeleteModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, moduleId }: { versionId: string; moduleId: string }) =>
      unwrap(
        await api.DELETE('/api/courses/versions/{versionId}/modules/{moduleId}', {
          params: { path: { versionId, moduleId } },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

// ---- Sections ----

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      moduleId,
      name,
      description,
    }: { versionId: string; moduleId: string; name: string; description: string }) =>
      unwrap(
        await api.POST('/api/courses/versions/{versionId}/modules/{moduleId}/sections', {
          params: { path: { versionId, moduleId } },
          body: { name, description },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      moduleId,
      sectionId,
      name,
      description,
    }: { versionId: string; moduleId: string; sectionId: string; name: string; description: string }) =>
      unwrap(
        await api.PUT('/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}', {
          params: { path: { versionId, moduleId, sectionId } },
          body: { name, description },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      moduleId,
      sectionId,
    }: { versionId: string; moduleId: string; sectionId: string }) =>
      unwrap(
        await api.DELETE('/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}', {
          params: { path: { versionId, moduleId, sectionId } },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

// ---- Items ----

export interface NewItemInput {
  versionId: string;
  moduleId: string;
  sectionId: string;
  name: string;
  description: string;
  type: 'VIDEO' | 'QUIZ';
  videoDetails?: { URL: string; startTime: string; endTime: string; points: number };
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, moduleId, sectionId, name, description, type, videoDetails }: NewItemInput) =>
      unwrap(
        await api.POST('/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items', {
          params: { path: { versionId, moduleId, sectionId } },
          body:
            type === 'VIDEO'
              ? { name, description, type, videoDetails }
              : {
                  name,
                  description,
                  type,
                  quizDetails: {
                    passThreshold: 0.7,
                    maxAttempts: -1,
                    quizType: 'NO_DEADLINE',
                    approximateTimeToComplete: '0:05:00',
                    allowPartialGrading: true,
                    allowHint: true,
                    allowSkip: false,
                    showCorrectAnswersAfterSubmission: true,
                    showExplanationAfterSubmission: true,
                    showScoreAfterSubmission: true,
                    questionVisibility: 1,
                    releaseTime: new Date().toISOString(),
                  },
                },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

export interface ItemDetail {
  _id: string;
  name: string;
  description: string;
  type: string;
  isOptional?: boolean;
  details: any;
}

export function useItemDetail(courseId: string, versionId: string, moduleId: string, sectionId: string, itemId: string, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'item', itemId],
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}', {
          params: { path: { courseId, versionId, moduleId, sectionId, itemId } },
        }),
      ) as unknown as { item: ItemDetail };
      return raw.item;
    },
    enabled: enabled && !!itemId,
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      courseId,
      versionId,
      itemId,
      name,
      description,
      type,
      details,
    }: { courseId: string; versionId: string; itemId: string; name: string; description: string; type: string; details: unknown }) =>
      unwrap(
        await api.PUT('/api/courses/{courseId}/versions/{versionId}/items/{itemId}', {
          params: { path: { courseId, versionId, itemId } },
          body: { name, description, type, details } as any,
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      courseId,
      itemsGroupId,
      itemId,
      versionId,
    }: { courseId: string; itemsGroupId: string; itemId: string; versionId: string }) =>
      unwrap(
        await api.DELETE('/api/courses/{courseId}/itemGroups/{itemsGroupId}/items/{itemId}', {
          params: { path: { courseId, itemsGroupId, itemId } },
        }),
      ),
    onSuccess: (_data, { versionId }) => invalidateVersion(queryClient, versionId),
  });
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: ['admin', 'course', courseId],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/courses/{courseId}', { params: { path: { courseId } } }),
      ) as unknown as { _id: string; name: string; description: string },
    enabled: !!courseId,
  });
}

export interface CourseEnrollment {
  role: string;
  status: string;
  enrollmentDate: string;
  user: { _id: string; email: string; firstName: string; lastName?: string };
}

export interface AdminUser {
  _id: string;
  email: string;
  firstName: string;
  lastName?: string;
  roles: 'admin' | 'user';
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const raw = unwrap(await api.GET('/api/users/', {})) as unknown as { users: any[] };
      return raw.users.map((u) => ({
        _id: toId(u._id),
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roles: u.roles,
      })) as AdminUser[];
    },
  });
}

export function useMakeAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.POST('/api/users/make-admin/{userId}', { params: { path: { userId } } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useCourseEnrollments(courseId: string, versionId: string) {
  return useQuery({
    queryKey: ['admin', 'enrollments', courseId, versionId],
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/users/enrollments/courses/{courseId}/versions/{versionId}', {
          params: { path: { courseId, versionId } },
        }),
      ) as unknown as { enrollments: CourseEnrollment[] };
      return raw.enrollments;
    },
    enabled: !!courseId && !!versionId,
  });
}

/**
 * The write side of course-setting/proctoring. The backend's body also carries
 * several unrelated settings (hpSystem, isPublic, caseStudies*, etc.) that this
 * feature never reads or edits — callers should spread the full object read via
 * `useCourseSettings` and only override `detectors` (see course-detail-page.tsx),
 * so those are round-tripped untouched rather than silently reset. The generated
 * OpenAPI type for this body is degraded (detectors/settings lose their real
 * shape), so it's cast at the call site here, same as useUpdateItem above.
 */
export function useUpdateCourseSettings(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown> & { detectors: DetectorSetting[] }) =>
      unwrap(
        await api.PUT('/api/setting/course-setting/{courseId}/{versionId}/proctoring', {
          params: { path: { courseId, versionId } },
          body: body as any,
        }),
      ) as unknown as { success: boolean },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: learnKeys.settings(courseId, versionId) });
    },
  });
}
