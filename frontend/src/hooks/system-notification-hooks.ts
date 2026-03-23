// Add these hooks to your existing hooks.ts file

import { api } from "@/lib/openapi";
import { queryClient } from "@/lib/client";

type SystemNotificationsResult = {
  notifications: any[];
  unreadCount: number;
  data: unknown;
} & ReturnType<typeof api.useQuery>;

// GET /notifications/user
export function useGetSystemNotifications(
  userId: string,
  onlyUnread: boolean = false,
  enabled: boolean = true,
):SystemNotificationsResult {
  const result = api.useQuery(
    'get',
    '/notifications/user',
    {
      params: {
        query: {
          limit: 30,
          ...(onlyUnread ? { onlyUnread: true } : {}),
        },
      },
    },
    {
      enabled: enabled && !!userId,
      refetchInterval: 30000, // poll every 30s
    },
  );

  return {
    ...result,
    notifications: (result.data as any)?.notifications ?? [],
    unreadCount: (result.data as any)?.unreadCount ?? 0,
  };
}

// POST /notifications/user/:notificationId/read
export function useMarkSystemNotificationAsRead() {
  return api.useMutation(
    'post',
    '/notifications/user/{notificationId}/read',
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['get', '/notifications/user'],
        });
      },
    },
  );
}

// POST /notifications/user/read-all
export function useMarkAllSystemNotificationsAsRead() {
  return api.useMutation(
    'post',
    '/notifications/user/read-all',
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['get', '/notifications/user'],
        });
      },
    },
  );
}