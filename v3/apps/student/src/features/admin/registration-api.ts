import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';

/**
 * Course registration, teacher side (backend: /course/registration/*).
 *
 * Contract notes:
 *  - PUT build-form REPLACES the whole registration settings object. Sending
 *    only the form would reopen a closed registration (isActive defaults to
 *    true) and wipe auto-approval, so saves always carry those values too.
 *  - Auto-approval with no emails approves everyone; otherwise an address is
 *    approved when it contains any listed pattern (e.g. "@iitrpr.ac.in").
 *  - Approving enrols the student and emails them. Bulk update is approve-only.
 */

export interface RegistrationSettings {
  jsonSchema: Record<string, unknown> | null;
  uiSchema: Record<string, unknown> | null;
  isActive: boolean;
  registrationsAutoApproved: boolean;
  autoapproval_emails: string[];
}

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RegistrationRequest {
  _id: string;
  userId: string;
  status: RegistrationStatus;
  detail: Record<string, unknown>;
  createdAt: string;
}

const keys = {
  settings: (versionId: string) =>
    ['studio', 'registration-settings', versionId] as const,
  requests: (versionId: string) =>
    ['studio', 'registration-requests', versionId] as const,
};

export function useRegistrationSettings(versionId: string) {
  return useQuery({
    queryKey: keys.settings(versionId),
    queryFn: async () => {
      const raw = unwrap(
        await api.GET(
          '/api/course/registration/build-form/version/{versionId}',
          { params: { path: { versionId } } },
        ),
      ) as unknown as Partial<RegistrationSettings>;
      return {
        jsonSchema: raw.jsonSchema ?? null,
        uiSchema: raw.uiSchema ?? null,
        isActive: raw.isActive ?? true,
        registrationsAutoApproved: !!raw.registrationsAutoApproved,
        autoapproval_emails: raw.autoapproval_emails ?? [],
      } satisfies RegistrationSettings;
    },
  });
}

/** Saves the form, carrying the current open/closed and auto-approval values along (see the note above). */
export function useSaveRegistrationForm(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settings,
      jsonSchema,
      uiSchema,
    }: {
      settings: RegistrationSettings;
      jsonSchema: unknown;
      uiSchema: unknown;
    }) =>
      unwrap(
        await api.PUT(
          '/api/course/registration/build-form/version/{versionId}',
          {
            params: { path: { versionId } },
            body: {
              jsonSchema,
              uiSchema,
              isActive: settings.isActive,
              registrationsAutoApproved: settings.registrationsAutoApproved,
              autoapproval_emails: settings.autoapproval_emails,
            } as never,
          },
        ),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: keys.settings(versionId),
      }),
  });
}

export function useToggleRegistration(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isActive: boolean) =>
      unwrap(
        await api.PATCH(
          '/api/course/registration/registration/version/{versionId}/toggle',
          {
            params: { path: { versionId } },
            body: { isActive },
          },
        ),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: keys.settings(versionId),
      }),
  });
}

export function useSaveAutoApproval(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      registrationsAutoApproved: boolean;
      autoapproval_emails: string[];
    }) =>
      unwrap(
        await api.PUT(
          '/api/course/registration/auto-approval/version/{versionId}',
          { params: { path: { versionId } }, body },
        ),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: keys.settings(versionId),
      }),
  });
}

export function useRegistrationRequests(
  versionId: string,
  opts: { page: number; status: RegistrationStatus | 'ALL'; search: string },
) {
  return useQuery({
    queryKey: [...keys.requests(versionId), opts],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/course/registration/requests/version/{versionId}', {
          params: {
            path: { versionId },
            query: {
              page: opts.page,
              limit: 20,
              status: opts.status,
              search: opts.search,
            } as never,
          },
        }),
      ) as unknown as {
        totalDocuments: number;
        totalPages: number;
        registrations: RegistrationRequest[];
      };
      return {
        total: raw.totalDocuments ?? 0,
        totalPages: raw.totalPages ?? 1,
        requests: raw.registrations ?? [],
      };
    },
  });
}

/** Approve or reject one request. Approving enrols the student and emails them. */
export function useSetRegistrationStatus(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: RegistrationStatus;
    }) =>
      unwrap(
        await api.PATCH('/api/course/registration/status/{registrationId}', {
          params: { path: { registrationId: id } },
          body: { status },
        }),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: keys.requests(versionId),
      }),
  });
}

/** Approve several requests at once (the bulk endpoint only approves). */
export function useBulkApproveRegistrations(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      unwrap(
        await api.PATCH('/api/course/registration/status/update/bulk', {
          body: { selected: ids },
        }),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: keys.requests(versionId),
      }),
  });
}
