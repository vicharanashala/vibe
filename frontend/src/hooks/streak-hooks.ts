import { useQuery } from '@tanstack/react-query';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  isActiveToday: boolean;
}

/**
 * Fetches the student's learning streak from the backend.
 * Uses IST timezone, strict calendar-day boundaries.
 * Counts all completed item types (videos, quizzes, blogs).
 */
export function useStudentStreak(enabled: boolean = true) {
  return useQuery<StreakData>({
    queryKey: ['student-streak'],
    queryFn: async () => {
      const token = localStorage.getItem('firebase-auth-token');
      const res = await fetch(
        `${import.meta.env.VITE_BASE_URL}/users/progress/streak`,
        {
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) {
        throw new Error('Failed to fetch streak');
      }
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true, // Refresh when tab is revisited
  });
}
