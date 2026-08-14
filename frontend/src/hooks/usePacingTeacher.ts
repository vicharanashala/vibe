import { api } from '@/lib/openapi';

export function useCoursePacingOverview(courseId?: string, versionId?: string, enabled = true) {
  const result = api.useQuery(
    'get',
    `/users/enrollments/courses/${courseId}/versions/${versionId}/pacing-overview` as any,
    {
      params: {
        path: { courseId: courseId!, versionId: versionId! },
      },
    },
    {
      enabled: Boolean(enabled && courseId && versionId),
    }
  );

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error ? (result.error as any).message : null,
    refetch: result.refetch,
  };
}

export function useStudentPacingDetail(
  courseId?: string,
  versionId?: string,
  userId?: string,
  cohortId?: string,
  enabled = true
) {
  const result = api.useQuery(
    'get',
    `/users/enrollments/courses/${courseId}/versions/${versionId}/students/${userId}/pacing` as any,
    {
      params: {
        path: { courseId: courseId!, versionId: versionId!, userId: userId! },
        query: cohortId ? { cohortId } : undefined,
      },
    },
    {
      enabled: Boolean(enabled && courseId && versionId && userId),
    }
  );

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error ? (result.error as any).message : null,
    refetch: result.refetch,
  };
}
