import { useCallback } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AdminResponseRequest,
  IFAQ,
  FAQCategory,
  SupportDashboardResponse,
  SupportQuestionStatus,
  SupportQuestionsResponse,
} from '@/modules/supportChat/types';

// VITE_BASE_URL already ends in the API prefix (e.g. http://localhost:4001/api),
// which is why paths below start at the resource, not at /api.
const API_BASE = import.meta.env.VITE_BASE_URL ?? '';

const getToken = () => localStorage.getItem('firebase-auth-token');

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * The queue is scoped server-side: admins see every course, instructors only
 * the ones they staff, and anyone else is refused outright. A 403 here is a
 * permission answer, not an empty queue, so it surfaces as an error.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (response.status === 403) {
    throw new Error('You do not have permission to view the support queue.');
  }
  if (!response.ok) {
    throw new Error(`Support request failed: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const supportAdminKeys = {
  dashboard: (courseId?: string) => ['admin-support', 'dashboard', courseId ?? 'all'] as const,
  questions: (status?: string, courseId?: string) =>
    ['admin-support', 'questions', status ?? 'open', courseId ?? 'all'] as const,
  faqs: (category?: FAQCategory) => ['admin-support', 'faqs', category ?? 'all'] as const,
};

export function useSupportDashboard(courseId?: string) {
  return useQuery({
    queryKey: supportAdminKeys.dashboard(courseId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);
      return request<SupportDashboardResponse>(`/admin/support/dashboard?${params}`);
    },
  });
}

/** Omitting `status` returns the open queue: escalated plus anything pending. */
export function useSupportQuestions(status?: SupportQuestionStatus, courseId?: string) {
  return useQuery({
    queryKey: supportAdminKeys.questions(status, courseId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (courseId) params.append('courseId', courseId);
      params.append('limit', '100');
      return request<SupportQuestionsResponse>(`/admin/support/questions?${params}`);
    },
  });
}

export function useRespondToQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questionId,
      request: body,
    }: {
      questionId: string;
      request: AdminResponseRequest;
    }) =>
      request(`/admin/support/questions/${questionId}/respond`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support'] });
    },
  });
}

export function useResolveQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionId: string) =>
      request(`/admin/support/questions/${questionId}/resolve`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support'] });
    },
  });
}

export function useSupportFAQs(category?: FAQCategory) {
  return useQuery({
    queryKey: supportAdminKeys.faqs(category),
    queryFn: () => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      return request<{ faqs: IFAQ[]; total: number }>(`/admin/support/faqs?${params}`);
    },
  });
}

/**
 * Imperative escape hatch for the FAQ bank, which has no screen of its own
 * yet. New UI should prefer the query hooks above.
 */
export default function useAdminSupport() {
  const createFAQ = useCallback(
    (faq: Omit<IFAQ, '_id' | 'createdAt' | 'updatedAt' | 'embedding' | 'createdBy'>) =>
      request<IFAQ>('/admin/support/faqs', {
        method: 'POST',
        body: JSON.stringify(faq),
      }),
    []
  );

  const updateFAQ = useCallback(
    (faqId: string, updates: Partial<IFAQ>) =>
      request<IFAQ>(`/admin/support/faqs/${faqId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    []
  );

  const deleteFAQ = useCallback(
    (faqId: string) =>
      request<{ success: boolean; message: string }>(`/admin/support/faqs/${faqId}`, {
        method: 'DELETE',
      }),
    []
  );

  return {
    createFAQ,
    updateFAQ,
    deleteFAQ,
  };
}
