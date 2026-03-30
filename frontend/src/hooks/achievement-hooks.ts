import { useState, useEffect, useCallback } from 'react';

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/achievements`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('firebase-auth-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type AchievementTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface Achievement {
  _id: string;
  slug: string;
  title: string;
  description: string;
  tier: AchievementTier;
  requiredCourseCount: number;
  badgeKey: string;
  earned: boolean;
  earnedAt?: string | null;
}

export function useGetAchievements(userId: string, enabled: boolean = true) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(BASE_URL, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch achievements (${res.status})`);
      }

      const result = await res.json();
      setAchievements(result.achievements ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load achievements');
      console.error('useGetAchievements error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, enabled]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  return { achievements, isLoading, error, refetch: fetchAchievements };
}
