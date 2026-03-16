import { api } from "@/lib/openapi";
import { components } from '@/types/schema';

// GET /ejection-policies
export function useEjectionPolicies(
  scope?: 'platform' | 'course',
  courseId?: string,
  isActive?: boolean
) {
  const params: any = {};
  if (scope) params.scope = scope;
  if (courseId) params.courseId = courseId;
  if (isActive !== undefined) params.active = isActive;

  const result = api.useQuery("get", "/ejection-policies", { params: { query: params } });
   const policies =
    (result.data as any)?.content?.["application/json"]?.policies ?? [];
  return {
    ...result,
     policies,
    error: result.error ? (result.error.message || 'Failed to load policies') : null
  };
}

// POST /ejection-policies
export function useCreateEjectionPolicy(): {
  mutate: (variables: { body: components['schemas']['CreateEjectionPolicyBody'] }) => void,
  mutateAsync: (variables: { body: components['schemas']['CreateEjectionPolicyBody'] }) => Promise<components['schemas']['EjectionPolicyResponse']>,
  data: components['schemas']['EjectionPolicyResponse'] | undefined,
  error: string | null,
  isPending: boolean,
  isSuccess: boolean,
  isError: boolean,
  isIdle: boolean,
  reset: () => void,
  status: 'idle' | 'pending' | 'success' | 'error'
} {
  const result = api.useMutation("post", "/ejection-policies");
  return {
    ...result,
    error: result.error ? (result.error.message || 'Policy creation failed') : null
  };
}

// PUT /ejection-policies/{policyId}
export function useUpdateEjectionPolicy(): {
  mutate: (variables: { params: { path: { policyId: string } }, body: components['schemas']['UpdateEjectionPolicyBody'] }) => void,
  mutateAsync: (variables: { params: { path: { policyId: string } }, body: components['schemas']['UpdateEjectionPolicyBody'] }) => Promise<components['schemas']['EjectionPolicyResponse']>,
  data: components['schemas']['EjectionPolicyResponse'] | undefined,
  error: string | null,
  isPending: boolean,
  isSuccess: boolean,
  isError: boolean,
  isIdle: boolean,
  reset: () => void,
  status: 'idle' | 'pending' | 'success' | 'error'
} {
  const result = api.useMutation("put", "/ejection-policies/{policyId}");
  return {
    ...result,
    error: result.error ? (result.error.message || 'Policy update failed') : null
  };
}

// DELETE /ejection-policies/{policyId}
export function useDeleteEjectionPolicy(): {
  mutate: (variables: { params: { path: { policyId: string } } }) => void,
  mutateAsync: (variables: { params: { path: { policyId: string } } }) => Promise<components['schemas']['DeletePolicyResponse']>,
  data: components['schemas']['DeletePolicyResponse'] | undefined,
  error: string | null,
  isPending: boolean,
  isSuccess: boolean,
  isError: boolean,
  isIdle: boolean,
  reset: () => void,
  status: 'idle' | 'pending' | 'success' | 'error'
} {
  const result = api.useMutation("delete", "/ejection-policies/{policyId}");
  return {
    ...result,
    error: result.error ? (result.error.message || 'Policy deletion failed') : null
  };
}

// POST /ejection-policies/{policyId}/toggle
export function useTogglePolicyStatus(): {
  mutate: (variables: { params: { path: { policyId: string } } }) => void,
  mutateAsync: (variables: { params: { path: { policyId: string } } }) => Promise<components['schemas']['EjectionPolicyResponse']>,
  data: components['schemas']['EjectionPolicyResponse'] | undefined,
  error: string | null,
  isPending: boolean,
  isSuccess: boolean,
  isError: boolean,
  isIdle: boolean,
  reset: () => void,
  status: 'idle' | 'pending' | 'success' | 'error'
} {
  const result = api.useMutation("post", "/ejection-policies/{policyId}/toggle");
  return {
    ...result,
    error: result.error ? (result.error.message || 'Policy toggle failed') : null
  };
}

// GET /ejection-policies/{policyId}
export function useEjectionPolicy(policyId: string) {
  const result = api.useQuery("get", "/ejection-policies/{policyId}", {
    params: { path: { policyId } }
  });
  return {
    ...result,
    error: result.error ? (result.error.message || 'Failed to load policy') : null
  };
}

// GET /ejection-policies/courses/{courseId}/active
export function useActivePoliciesForCourse(courseId: string) {
  const result = api.useQuery("get", "/ejection-policies/courses/{courseId}/active", {
    params: { path: { courseId } }
  });
  return {
    ...result,
    policies: (result.data as any)?.policies ?? [],
    error: result.error ? (result.error.message || 'Failed to load active policies') : null
  };
}