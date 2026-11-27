import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';

import type { FormValues } from './form-schema';

export interface MyFeedback {
  details: FormValues;
  createdAt: string;
}

export const myFeedbackKey = (itemId: string) => ['feedback', 'mine', itemId] as const;

/** The signed-in student's current answer to a feedback form, or null (GET /quizzes/{item}/feedback/mine). */
export function useMyFeedback(itemId: string, enabled = true) {
  return useQuery({
    queryKey: myFeedbackKey(itemId),
    enabled,
    queryFn: async (): Promise<MyFeedback | null> => {
      const data = unwrap(
        await api.GET('/api/quizzes/{itemId}/feedback/mine', {
          params: { path: { itemId } },
        }),
      ) as unknown as { feedback?: MyFeedback | null };
      return data?.feedback ?? null;
    },
  });
}

/** "10 Nov 2026" in the student's locale. */
export function answeredOn(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
