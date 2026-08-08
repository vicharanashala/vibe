import { api } from '@/lib/openapi';
import { queryClient } from '@/lib/client';

export function usePacingPlan(courseId?: string, versionId?: string, cohortId?: string, useTeacherDeadline?: boolean, enabled = true) {
  const result = api.useQuery(
    'get',
    `/users/progress/courses/${courseId}/versions/${versionId}/pacing` as any,
    {
      params: {
        path: { courseId: courseId!, versionId: versionId! },
        query: { cohortId, useTeacherDeadline },
      },
    },
    {
      enabled: Boolean(enabled && courseId && versionId),
    },
  );

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error ? result.error.message : null,
    refetch: result.refetch,
  };
}

export function useSetPacingTarget() {
  const mutation = api.useMutation(
    'patch',
    '/users/progress/courses/{courseId}/versions/{versionId}/pacing-target' as any,
    {
      onSuccess: (_data, variables) => {
        const path = (variables as any)?.params?.path;
        if (path?.courseId && path?.versionId) {
          queryClient.invalidateQueries({
            queryKey: [
              'get',
              `/users/progress/courses/${path.courseId}/versions/${path.versionId}/pacing`,
            ],
          });
        }
      },
    }
  );

  return mutation;
}
