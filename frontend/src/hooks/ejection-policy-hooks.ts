import { queryClient } from "@/lib/client";
import { api, fetchClient } from "@/lib/openapi";
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const STUDENT_LIST_KEY = 'get /ejections/courses/{courseId}/versions/{courseVersionId}/cohorts/{cohortId}/students';

// GET /ejection-policies
export function useEjectionPolicies(
  courseId?: string,
  courseVersionId?: string,
  cohortId?: string,
  isActive?: boolean,
  enabled: boolean = true
) {
  const params: any = {};
  if (courseId) params.courseId = courseId;
  if (courseVersionId) params.courseVersionId = courseVersionId;
  if (cohortId) params.cohortId = cohortId;
  if (isActive !== undefined) params.active = isActive;

  const result = api.useQuery(
    "get",
    "/ejection-policies",
    { params: { query: params } },
    { enabled }
  );

  return {
    ...result,
    policies: result.data?.policies ?? [],
    isAdmin: result.data?.isAdmin ?? false,
    error: result.error ? result.error.message || "Failed to load policies" : null,
  };
}

// POST /ejection-policies
export function useCreateEjectionPolicy() {
  const result = api.useMutation("post", "/ejection-policies", {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["get", "/ejection-policies"] }),
  });
  return { ...result, error: result.error ? result.error.message || 'Policy creation failed' : null };
}

// PUT /ejection-policies/{policyId}
export function useUpdateEjectionPolicy() {
  const result = api.useMutation("put", "/ejection-policies/{policyId}", {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["get", "/ejection-policies"] }),
  });
  return { ...result, error: result.error ? result.error.message || 'Policy update failed' : null };
}

// DELETE /ejection-policies/{policyId}
export function useDeleteEjectionPolicy() {
  const result = api.useMutation("delete", "/ejection-policies/{policyId}", {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["get", "/ejection-policies"] }),
  });
  return { ...result, error: result.error ? result.error.message || 'Policy deletion failed' : null };
}

// POST /ejection-policies/{policyId}/toggle
export function useTogglePolicyStatus() {
  const result = api.useMutation("post", "/ejection-policies/{policyId}/toggle", {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["get", "/ejection-policies"] }),
  });
  return { ...result, error: result.error ? result.error.message || 'Policy toggle failed' : null };
}

// GET /ejection-policies/{policyId}
export function useEjectionPolicy(policyId: string) {
  const result = api.useQuery("get", "/ejection-policies/{policyId}", {
    params: { path: { policyId } }
  });
  return { ...result, error: result.error ? result.error.message || 'Failed to load policy' : null };
}

// GET active policies for course version cohort
export function useActivePoliciesForCourse(
  courseId: string,
  courseVersionId: string,
  cohortId: string,
) {
  const result = api.useQuery(
    "get",
    "/ejection-policies/courses/{courseId}/versions/{courseVersionId}/cohorts/{cohortId}/active",
    { params: { path: { courseId, courseVersionId, cohortId } } },
    { enabled: !!courseId && !!courseVersionId && !!cohortId },
  );
  return {
    policies: (result.data as any)?.policies ?? [],
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error ? result.error.message || 'Failed to load active policies' : null,
  };
}

// Helper — invalidates the student list regardless of pagination/search params
function invalidateStudentList() {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'get' &&
      typeof query.queryKey[1] === 'string' &&
      (query.queryKey[1] as string).includes('/ejections/courses/'),
  });
}

// GET students for ejection page
export function useEjectionStudents(
  courseId: string,
  courseVersionId: string,
  cohortId: string,
  page: number = 1,
  limit: number = 20,
  search: string = '',
  statusFilter: 'all' | 'ejected' | 'active' = 'all',
  enabled: boolean = true,
) {
  const result = api.useQuery(
    'get',
    '/ejections/courses/{courseId}/versions/{courseVersionId}/cohorts/{cohortId}/students',
    {
      params: {
        path: { courseId, courseVersionId, cohortId },
        query: {
          page,
          limit,
          ...(search ? { search } : {}),
          ...(statusFilter !== 'all' ? { statusFilter } : {}),
        },
      },
    },
    { enabled: enabled && !!courseId && !!courseVersionId && !!cohortId },
  );

  return {
    ...result,
    students: (result.data as any)?.students ?? [],
    policies: (result.data as any)?.policies ?? [],
    totalDocuments: (result.data as any)?.totalDocuments ?? 0,
    totalPages: (result.data as any)?.totalPages ?? 0,
    currentPage: (result.data as any)?.currentPage ?? 1,
  };
}

// POST /ejections/courses/:courseId/versions/:courseVersionId/users/:userId
export function useManualEject() {
  const result = api.useMutation(
    'post',
    '/ejections/courses/{courseId}/versions/{courseVersionId}/users/{userId}',
    { onSuccess: invalidateStudentList },
  );
  return { ...result, error: result.error ? result.error.message || 'Failed to eject student' : null };
}

// POST /ejections/bulk
export function useBulkEject() {
  const result = api.useMutation(
    'post',
    '/ejections/bulk',
    { onSuccess: invalidateStudentList },
  );
  return { ...result, error: result.error ? result.error.message || 'Failed to bulk eject students' : null };
}

// POST /reinstatements/courses/:courseId/versions/:courseVersionId/users/:userId
export function useReinstate() {
  const result = api.useMutation(
    'post',
    '/reinstatements/courses/{courseId}/versions/{courseVersionId}/users/{userId}',
    {
      onSuccess: invalidateStudentList,
      onError: (error: any) => {
        toast.error(error.message || 'Failed to reinstate student');
      },
    },
  );
  return { ...result, error: result.error ? result.error.message || 'Failed to reinstate student' : null };
}

export const useEjectionHistory = (
  courseId: string,
  courseVersionId: string,
  query: {
    triggerType?: string;
    cohortId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
    timezoneOffset?: number;
  },
) => {
  const result: any = api.useQuery(
    'get',
    '/ejections/history' as any,
    {
      params: {
        query: {
          ...query,
          courseId,
          courseVersionId,
        },
      },
    },
    {
      enabled: !!courseId && !!courseVersionId,
      refetchOnWindowFocus: false,
    },
  );

  return {
    data: result.data as any,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
};

export const useExportEjectionHistory = () => {
  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      courseVersionId: string;
      triggerType?: string;
      cohortId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      timezoneOffset?: number;
    }) => {
      const { data, error, response } = await fetchClient.GET('/ejections/history/export' as any, {
        params: {
          query: params
        },
        parseAs: 'blob' as any
      });
      
      if (error || !response.ok || !data) {
        throw new Error((error as any)?.message || 'Failed to export ejection history');
      }

      const blob = data as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ejection_history_${new Date().toLocaleDateString()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export ejection history');
    },
  });
};

// POST /reinstatements/bulk
export function useBulkReinstate() {
  const result = api.useMutation(
    'post',
    '/reinstatements/bulk',
    { onSuccess: invalidateStudentList },
  );
  return { ...result, error: result.error ? result.error.message || 'Failed to bulk reinstate students' : null };
}