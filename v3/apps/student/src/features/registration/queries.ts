import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { useAuth } from '@/features/auth/auth-provider';
import { api } from '@/lib/api';

import type { FormSchema, UiSchema } from './schema-form';

/** Shapes follow the backend's responses (captured in src/test/fixtures/registration-*.json). */
export interface RegistrationDetails {
  courseId: string;
  course: { _id: string; name: string; description?: string };
  version: string;
  description?: string;
  modules: { id: string; name: string; description?: string; itemsCount: number }[];
  totalItems: number;
  instructors: { name: string; profileImage: string | null }[];
  cohorts?: { cohortId: string; cohortName: string; isActive: boolean }[];
}

export interface RegistrationForm {
  jsonSchema: FormSchema;
  uiSchema?: UiSchema;
  isActive: boolean;
}

export interface StudentRegistration {
  _id: string;
  versionId: string;
  courseId: string;
  courseName: string;
  cohortId: string | null;
  status: 'PENDING' | 'REJECTED' | 'APPROVED';
  createdAt: string;
  updatedAt: string | null;
}

export type RegistrationResult = { registrationId: string; status: 'APPROVED' | 'PENDING' };

export const registrationKeys = {
  details: (versionId: string) => ['registration', 'details', versionId] as const,
  form: (versionId: string) => ['registration', 'form', versionId] as const,
  pending: (uid: string) => ['registration', 'pending', uid] as const,
  rejected: (uid: string) => ['registration', 'rejected', uid] as const,
};

export function useRegistrationDetails(versionId: string) {
  return useQuery({
    queryKey: registrationKeys.details(versionId),
    queryFn: async () =>
      unwrap(await api.GET('/api/course/registration/version/{versionId}', { params: { path: { versionId } } })) as unknown as RegistrationDetails,
  });
}

export function useRegistrationForm(versionId: string) {
  return useQuery({
    queryKey: registrationKeys.form(versionId),
    queryFn: async () =>
      unwrap(await api.GET('/api/course/registration/form/version/{versionId}', { params: { path: { versionId } } })) as unknown as RegistrationForm,
  });
}

/** The backend checks `studentId` against the caller's Firebase UID. */
export function usePendingRegistrations() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  return useQuery({
    queryKey: registrationKeys.pending(uid),
    enabled: !!uid,
    queryFn: async () =>
      unwrap(await api.GET('/api/course/registration/pending/student', { params: { query: { studentId: uid } } })) as unknown as StudentRegistration[],
  });
}

export function useRejectedRegistrations() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  return useQuery({
    queryKey: registrationKeys.rejected(uid),
    enabled: !!uid,
    queryFn: async () =>
      unwrap(await api.GET('/api/course/registration/rejected/student', { params: { query: { studentId: uid } } })) as unknown as StudentRegistration[],
  });
}

export function useRegister(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    /** `recaptchaToken`: from useRecaptcha (NO_CAPTCHA when reCAPTCHA is off). */
    mutationFn: async ({ detail, recaptchaToken }: { detail: Record<string, unknown>; recaptchaToken: string }) =>
      unwrap(
        await api.POST('/api/course/registration/version/{versionId}', {
          params: { path: { versionId } },
          body: { ...detail, recaptchaToken },
        }),
      ) as unknown as RegistrationResult,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registration'] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      // Joined (or requested) courses drop out of the catalogue.
      void queryClient.invalidateQueries({ queryKey: ['explore'] });
    },
  });
}

/** The backend reports these as plain error messages; map them to page states. */
export function registrationErrorKind(message: string): 'already-registered' | 'already-enrolled' | 'closed' | null {
  if (/already registered/i.test(message)) return 'already-registered';
  if (/already enrolled/i.test(message)) return 'already-enrolled';
  if (/registration is not active|version .* is inactive/i.test(message)) return 'closed';
  return null;
}
