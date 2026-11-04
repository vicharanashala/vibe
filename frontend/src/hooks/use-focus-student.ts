import { useQuery } from '@tanstack/react-query';

interface FocusStudent {
  _id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Looks up one student by id, for opening their progress from a
 * struggling-student alert (#1109). Disabled when no id is given.
 */
export function useFocusStudent(userId: string | undefined) {
  return useQuery({
    queryKey: ['focus-student', userId],
    enabled: !!userId,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FocusStudent> => {
      const token = localStorage.getItem('firebase-auth-token');
      const res = await fetch(
        `${import.meta.env.VITE_BASE_URL}/users/${encodeURIComponent(userId!)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        },
      );
      if (!res.ok) {
        throw new Error(`Could not load the student (${res.status})`);
      }
      return res.json();
    },
  });
}
