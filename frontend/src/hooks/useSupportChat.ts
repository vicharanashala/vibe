import { useCallback } from 'react';
import { ChatMessageResponse } from '@/modules/supportChat/types';

const API_BASE = import.meta.env.VITE_BASE_URL || 'http://localhost:3001';

export default function useSupportChat() {
  const sendMessage = useCallback(
    async (
      question: string,
      courseId?: string,
      courseVersionId?: string,
      cohortId?: string
    ): Promise<ChatMessageResponse> => {
      const queryParams = new URLSearchParams();
      if (courseId) queryParams.append('courseId', courseId);
      if (courseVersionId) queryParams.append('courseVersionId', courseVersionId);
      if (cohortId) queryParams.append('cohortId', cohortId);

      const response = await fetch(
        `${API_BASE}/api/support/chat/message?${queryParams.toString()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify({
            question,
            context: {
              page: window.location.pathname,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.statusText}`);
      }

      return response.json();
    },
    []
  );

  const getHistory = useCallback(
    async (limit: number = 50) => {
      const response = await fetch(
        `${API_BASE}/api/support/chat/history?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`History API error: ${response.statusText}`);
      }

      return response.json();
    },
    []
  );

  const getQuestion = useCallback(
    async (questionId: string) => {
      const response = await fetch(`${API_BASE}/api/support/chat/${questionId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Question API error: ${response.statusText}`);
      }

      return response.json();
    },
    []
  );

  const rateResolution = useCallback(
    async (questionId: string, rating: 'helpful' | 'not_helpful') => {
      const response = await fetch(
        `${API_BASE}/api/support/chat/${questionId}/rate`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify({ rating }),
        }
      );

      if (!response.ok) {
        throw new Error(`Rate API error: ${response.statusText}`);
      }

      return response.json();
    },
    []
  );

  return {
    sendMessage,
    getHistory,
    getQuestion,
    rateResolution,
  };
}
