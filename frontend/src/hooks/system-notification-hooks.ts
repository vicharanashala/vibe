

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

export function useSubmitAppeal() {
  return api.useMutation(
    "post",
    "/appeals",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["get", "/notifications/user"],
        });
        queryClient.invalidateQueries({
          queryKey: ["get", "/appeals"],
        });
      },
    }
  );
}

export function useGetAppealById(appealId: string, enabled: boolean) {
  return api.useQuery(
    "get",
    "/appeals/{id}",
    {
      params: {
        path: { id: appealId },
      },
    },
    {
      enabled: enabled && !!appealId,
    }
  );
}

export function useApproveAppeal() {
  return api.useMutation(
    "post",
    "/appeals/{id}/approve",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["get", "/notifications/user"],
        });
        queryClient.invalidateQueries({
          queryKey: ["get", "/appeals"],
        });
      },
    }
  );
}

export function useRejectAppeal() {
  return api.useMutation(
    "post",
    "/appeals/{id}/reject",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["get", "/notifications/user"],
        });
        queryClient.invalidateQueries({
          queryKey: ["get", "/appeals"],
        });
      },
    }
  );
}

export function useGetAppeals(
  courseId?: string,
  courseVersionId?: string,
  cohortId?: string,
  status?: string,
  enabled: boolean = true,
) {
  const result = api.useQuery(
    'get',
    '/appeals',
    {
      params: {
        query: {
          ...(courseId ? { courseId } : {}),
          ...(courseVersionId ? { courseVersionId } : {}),
          ...(cohortId ? { cohortId } : {}),
          ...(status ? { status } : {}),
        },
      },
    },
    { enabled: enabled && !!courseId && !!courseVersionId && !!cohortId },
  );

  return {
    ...result,
    appeals: (result.data as any) ?? [],
  };
}
export function useAcknowledgePolicyUpdate() {
  return api.useMutation(
    'post',
    '/users/enrollments/courses/{courseId}/versions/{courseVersionId}/cohorts/{cohortId}/policy-acknowledge' as any,
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['get', '/notifications/user'] });
        queryClient.invalidateQueries({ queryKey: ['get', '/users/enrollments'] });
      },
    }
  );
}