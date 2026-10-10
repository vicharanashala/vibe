import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';
import { env } from '@/lib/env';

export interface Notification {
  _id: string;
  type: 'ejection' | 'reinstatement' | 'policy_created' | 'policy_updated' | 'inactivity_warning' | string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
  policyId?: string;
}

export interface NotificationsPage {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationKeys = {
  all: ['notifications'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () =>
      unwrap(await api.GET('/api/notifications/user/', { params: { query: { limit: 20 } } })) as unknown as NotificationsPage,
    // Polling instead of a push channel - simple and good enough for ejection/policy alerts,
    // which aren't latency-sensitive.
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.POST('/api/notifications/user/{notificationId}/read', { params: { path: { notificationId } } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.POST('/api/notifications/user/read-all', {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export interface PendingInvite {
  inviteId: string;
  email: string;
  inviteStatus: 'ACCEPTED' | 'PENDING' | 'CANCELLED' | 'EMAIL_FAILED' | 'ALREADY_ENROLLED';
  role: 'INSTRUCTOR' | 'STUDENT' | 'MANAGER' | 'TA' | 'STAFF';
  courseId?: string;
  courseVersionId?: string;
  course?: { name?: string };
}

export const inviteKeys = {
  all: ['pending-invites'] as const,
};

export function usePendingInvites() {
  return useQuery({
    queryKey: inviteKeys.all,
    queryFn: async () => {
      const data = unwrap(await api.GET('/api/notifications/invite/', {})) as unknown as { invites: PendingInvite[] };
      return data.invites.filter((i) => i.inviteStatus === 'PENDING');
    },
    refetchInterval: 60_000,
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      // This endpoint returns an HTML redirect page (built for email links) rather than JSON,
      // so it's called as a plain fetch and only the status code is checked.
      const res = await fetch(`${env.apiBaseUrl}/api/notifications/invite/${inviteId}`);
      if (!res.ok) throw new Error('Failed to accept invite');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inviteKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}
