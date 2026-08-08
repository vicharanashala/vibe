import { api } from '@/lib/openapi';
import { queryClient } from '@/lib/client';

export function useCombinedPacingPlan(enabled = true) {
  const result = api.useQuery(
    'get',
    '/users/progress/pacing/combined' as any,
    {},
    {
      enabled,
    },
  );

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error ? (result.error as any).message : null,
    refetch: result.refetch,
  };
}

export function useSetCombinedPacingTarget() {
  const mutation = api.useMutation(
    'put',
    '/users/progress/pacing/combined' as any,
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            'get',
            '/users/progress/pacing/combined',
          ],
        });
      },
    }
  );

  return mutation;
}

export function useClearCombinedPacingTarget() {
  const mutation = api.useMutation(
    'delete',
    '/users/progress/pacing/combined' as any,
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            'get',
            '/users/progress/pacing/combined',
          ],
        });
      },
    }
  );

  return mutation;
}