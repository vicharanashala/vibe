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

/**
 * `roles` on a user is stored as a string in some accounts and as an array
 * (e.g. ["admin"]) in others; normalise it the way the backend does
 * (AbilityDecorator.normalizeGlobalRole) so it's always 'admin' or 'user'.
 */
export function normalizeGlobalRole(roles: unknown): 'admin' | 'user' {
  const values = Array.isArray(roles) ? roles : [roles];
  return values.some((r) => typeof r === 'string' && r.toLowerCase() === 'admin') ? 'admin' : 'user';
}

/** Course roles are stored inconsistently cased, and sometimes missing; uppercase them, defaulting to STUDENT. */
export function normalizeCourseRole(role: unknown): string {
  return typeof role === 'string' && role.trim() ? role.trim().toUpperCase() : 'STUDENT';
}

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const me = unwrap(await api.GET('/api/users/me', {})) as unknown as CurrentUserProfile;
      return { ...me, roles: normalizeGlobalRole(me.roles) };
    },
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

/** Every course (GET /courses/, admins only). */
export function useAllCourses(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'courses'],
    enabled,
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

/** Course roles that open the studio. The backend grants these course-level teaching rights. */
export const TEACHING_ROLES = ['INSTRUCTOR', 'MANAGER', 'TA'] as const;

/**
 * Courses the signed-in user teaches, from their own enrolments (GET
 * /users/enrollments, one call per role: the endpoint filters by a single role).
 * Shaped like AdminCourse; `versions` holds only the versions they teach.
 */
export function useTaughtCourses(enabled = true) {
  return useQuery({
    queryKey: ['studio', 'taught-courses'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const pages = await Promise.all(
        TEACHING_ROLES.map(
          async (role) =>
            unwrap(
              await api.GET('/api/users/enrollments', {
                params: { query: { page: 1, limit: 100, role, tab: 'active' } as never },
              }),
            ) as unknown as { enrollments?: any[] },
        ),
      );
      const byCourse = new Map<string, AdminCourse>();
      for (const e of pages.flatMap((p) => p.enrollments ?? [])) {
        if (!(TEACHING_ROLES as readonly string[]).includes(e.role)) continue;
        const courseId = toId(e.courseId);
        const versionId = toId(e.courseVersionId);
        const course: AdminCourse = byCourse.get(courseId) ?? {
          _id: courseId,
          name: e.course?.name ?? 'Course',
          description: e.course?.description ?? '',
          versions: [],
          instructors: [],
          createdAt: e.course?.createdAt ?? e.enrollmentDate,
        };
        if (!course.versions.includes(versionId)) course.versions.push(versionId);
        byCourse.set(courseId, course);
      }
      return [...byCourse.values()];
    },
  });
}

/**
 * Who may use the studio: admins (everything), and anyone who teaches at least
 * one course as instructor, manager or TA (just those courses). There's no
 * separate teacher login; it follows the backend's own course roles.
 */
export function useStudioAccess() {
  const profile = useCurrentUserProfile();
  const isAdmin = profile.data?.roles === 'admin';
  const taught = useTaughtCourses(profile.isSuccess && !isAdmin);
  return {
    profile,
    isAdmin,
    isPending: profile.isPending || (profile.isSuccess && !isAdmin && taught.isPending),
    canEnter: isAdmin || (taught.data?.length ?? 0) > 0,
  };
}

/** The studio's course list: every course for admins, the ones you teach otherwise. */
export function useStudioCourses() {
  const { profile, isAdmin } = useStudioAccess();
  const all = useAllCourses(isAdmin);
  const taught = useTaughtCourses(profile.isSuccess && !isAdmin);
  return isAdmin ? all : taught;
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
  /** One invite per address; the endpoint takes a batch. */
  emails: string[];
  role: 'STUDENT' | 'INSTRUCTOR';
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ courseId, versionId, emails, role }: InviteUserInput) =>
      unwrap(
        await api.POST('/api/notifications/invite/courses/{courseId}/versions/{versionId}', {
          params: { path: { courseId, versionId } },
          body: { inviteData: emails.map((email) => ({ email, role })) },
        }),
      ) as unknown as { invites: { inviteId: string; email: string; inviteStatus: string }[] },
    onSuccess: (_data, { courseId, versionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'enrollments', courseId, versionId] });
    },
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
  /** Percent complete, 0-100. */
  progress?: number;
  completedItemsCount?: number;
  user: { _id: string; email: string; firstName: string; lastName?: string };
}

export interface AdminUser {
  _id: string;
  email: string;
  firstName: string;
  lastName?: string;
  roles: 'admin' | 'user';
  /**
   * When the account was created. Users have no createdAt field, but each _id
   * is a MongoDB ObjectId made at sign-up (UserRepository.create), and its
   * first 4 bytes are the creation time in seconds. Null if the id isn't one.
   */
  joinedAt: number | null;
  /** Lowercased "first last email", for searching. */
  searchText: string;
}

/** Creation time (ms) encoded in a 24-hex MongoDB ObjectId, or null. */
export function objectIdTime(id: string): number | null {
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;
  const seconds = parseInt(id.slice(0, 8), 16);
  return seconds > 0 ? seconds * 1000 : null;
}

/** Every account (GET /users/, admins only). The endpoint has no paging, so this is the whole list; it's cached for 5 minutes. */
export function useAllUsers(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'users'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const raw = unwrap(await api.GET('/api/users/', {})) as unknown as { users: any[] };
      return raw.users.map((u): AdminUser => {
        const _id = toId(u._id);
        const email = typeof u.email === 'string' ? u.email : '';
        const firstName = typeof u.firstName === 'string' ? u.firstName : '';
        const lastName = typeof u.lastName === 'string' ? u.lastName : undefined;
        return {
          _id,
          email,
          firstName,
          lastName,
          roles: normalizeGlobalRole(u.roles),
          joinedAt: objectIdTime(_id),
          searchText: `${firstName} ${lastName ?? ''} ${email}`.toLowerCase(),
        };
      });
    },
  });
}

export function useMakeAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => unwrap(await api.POST('/api/users/make-admin/{userId}', { params: { path: { userId } } })),
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
      return (raw.enrollments ?? []).map((e) => ({ ...e, role: normalizeCourseRole(e.role) as CourseEnrollment['role'] }));
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
 * shape), so it's cast at the call site here.
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
