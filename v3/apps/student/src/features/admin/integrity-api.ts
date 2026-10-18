import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { toId } from '@/features/learn/quiz-api';
import { api } from '@/lib/api';

/**
 * Proctoring incidents and their follow-up (backend: /anomalies, /ejections,
 * /reinstatements, /appeals). Contract notes:
 *  - Incident photos come from GET /anomalies/{id}/…, which returns a signed
 *    URL. That call fails (500) for incidents saved without a photo, so the
 *    UI asks only when the record has a fileName, and treats failure as "no photo".
 *  - Removing (ejecting) a student emails them; removed students drop out of
 *    the enrolment list, so the removal history is the source of truth.
 *  - Approving an appeal reinstates the student; rejecting needs a reason.
 */

export type IncidentType =
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'BLUR_DETECTION'
  | 'VOICE_DETECTION'
  | 'FACE_RECOGNITION'
  | 'HAND_GESTURE_DETECTION'
  | 'FOCUS'
  | 'TAB_SWITCH_DURING_REVIEW'
  | 'PASTE_ATTEMPTED';

export interface Incident {
  _id: string;
  userId: string;
  type: IncidentType;
  itemId?: string;
  createdAt: string;
  studentName?: string;
  studentEmail?: string;
  cohortName?: string | null;
  /** Present when a photo was saved with the incident. */
  fileName?: string;
}

const keys = {
  all: (courseId: string, versionId: string) =>
    ['studio', 'incidents', courseId, versionId] as const,
  removals: (courseId: string, versionId: string) =>
    ['studio', 'removals', courseId, versionId] as const,
  appeals: (courseId: string, versionId: string) =>
    ['studio', 'appeals', courseId, versionId] as const,
};

const normalise = (a: any): Incident => ({
  ...a,
  _id: toId(a._id),
  userId: toId(a.userId),
  itemId: a.itemId ? toId(a.itemId) : undefined,
});

export function useIncidentStats(courseId: string, versionId: string) {
  return useQuery({
    queryKey: [...keys.all(courseId, versionId), 'stats'],
    queryFn: async () =>
      unwrap(
        await api.GET(
          '/api/anomalies/course/{courseId}/version/{versionId}/stats',
          { params: { path: { courseId, versionId } } },
        ),
      ) as unknown as Partial<Record<IncidentType, number>>,
  });
}

export function useIncidents(
  courseId: string,
  versionId: string,
  opts: { page: number; limit: number; type?: IncidentType; search?: string },
) {
  return useQuery({
    queryKey: [...keys.all(courseId, versionId), 'list', opts],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/anomalies/course/{courseId}/version/{versionId}', {
          params: {
            path: { courseId, versionId },
            query: {
              page: opts.page,
              limit: opts.limit,
              sortField: 'createdAt',
              sortOrder: 'desc',
              ...(opts.type ? { type: opts.type } : {}),
              ...(opts.search ? { search: opts.search } : {}),
            } as never,
          },
        }),
      ) as unknown as {
        data: any[];
        totalDocuments: number;
        totalPages: number;
      };
      return {
        total: raw.totalDocuments ?? 0,
        totalPages: raw.totalPages ?? 1,
        incidents: (raw.data ?? []).map(normalise),
      };
    },
  });
}

/** The signed photo URL for one incident (only asked for when it has a photo). */
export function useIncidentPhoto(
  courseId: string,
  versionId: string,
  incident: Incident | null,
) {
  return useQuery({
    queryKey: ['studio', 'incident-photo', incident?._id],
    enabled: !!incident?.fileName,
    retry: false,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const raw = unwrap(
        await api.GET(
          '/api/anomalies/{anomalyId}/course/{courseId}/version/{versionId}',
          {
            params: { path: { anomalyId: incident!._id, courseId, versionId } },
          },
        ),
      ) as unknown as { fileUrl?: string };
      return raw.fileUrl ?? null;
    },
  });
}

/** Dismiss a false alarm: deletes the incident (and its photo). */
export function useDismissIncident(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE('/api/anomalies/{id}', {
          params: { path: { id } },
          body: { courseId, versionId },
        }),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: keys.all(courseId, versionId),
      }),
  });
}

export interface Removal {
  userId: string;
  type: 'EJECTED' | 'REINSTATED' | string;
  reason?: string;
  trigger?: string;
  at: string;
  by?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** Removal history, newest first (GET /ejections/history). */
export function useRemovalHistory(courseId: string, versionId: string) {
  return useQuery({
    queryKey: keys.removals(courseId, versionId),
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/ejections/history', {
          params: {
            query: {
              courseId,
              courseVersionId: versionId,
              page: 1,
              limit: 500,
            } as never,
          },
        }),
      ) as unknown as { history: any[]; totalDocuments: number };
      return (raw.history ?? [])
        .map((h): Removal => ({
          userId: toId(h.userId),
          type: h.type,
          reason: h.ejectionReason ?? h.reason,
          trigger: h.triggerType,
          at: h.ejectedAt ?? h.reinstatedAt ?? h.createdAt,
          by: h.ejectedByName ?? h.reinstatedByName,
          firstName: h.firstName,
          lastName: h.lastName,
          email: h.email,
        }))
        .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
    },
  });
}

function invalidateAfterRemoval(
  queryClient: ReturnType<typeof useQueryClient>,
  courseId: string,
  versionId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: keys.removals(courseId, versionId),
  });
  void queryClient.invalidateQueries({
    queryKey: keys.appeals(courseId, versionId),
  });
  void queryClient.invalidateQueries({
    queryKey: ['admin', 'enrollments', courseId, versionId],
  });
}

/** Remove a student from the course (they're emailed the reason). */
export function useRemoveStudent(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason: string;
    }) =>
      unwrap(
        await api.POST(
          '/api/ejections/courses/{courseId}/versions/{courseVersionId}/users/{userId}',
          {
            params: { path: { courseId, courseVersionId: versionId, userId } },
            body: { reason },
          },
        ),
      ),
    onSuccess: () => invalidateAfterRemoval(queryClient, courseId, versionId),
  });
}

export function useReinstateStudent(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await api.POST(
          '/api/reinstatements/courses/{courseId}/versions/{courseVersionId}/users/{userId}',
          {
            params: { path: { courseId, courseVersionId: versionId, userId } },
            body: {},
          },
        ),
      ),
    onSuccess: () => invalidateAfterRemoval(queryClient, courseId, versionId),
  });
}

export interface Appeal {
  _id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  createdAt: string;
  evidenceImages: string[];
  rejectionReason?: string;
  student: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export function useAppeals(courseId: string, versionId: string) {
  return useQuery({
    queryKey: keys.appeals(courseId, versionId),
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/appeals/', {
          params: { query: { courseId, courseVersionId: versionId } as never },
        }),
      ) as unknown as any[];
      return (raw ?? [])
        .map((a): Appeal => ({
          _id: toId(a._id),
          status: a.status,
          reason: a.reason,
          createdAt: a.createdAt,
          evidenceImages: (a.evidenceImages ?? []).filter(
            (x: unknown) => typeof x === 'string',
          ),
          rejectionReason: a.rejectionReason,
          student: { ...a.student, id: toId(a.student?.id ?? a.userId) },
        }))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    },
  });
}

/** Approving reinstates the student. */
export function useDecideAppeal(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      approve,
      reason,
    }: {
      id: string;
      approve: boolean;
      reason?: string;
    }) =>
      approve
        ? unwrap(
            await api.POST('/api/appeals/{id}/approve', {
              params: { path: { id } },
            }),
          )
        : unwrap(
            await api.POST('/api/appeals/{id}/reject', {
              params: { path: { id } },
              body: { reason: reason ?? '' },
            }),
          ),
    onSuccess: () => invalidateAfterRemoval(queryClient, courseId, versionId),
  });
}
