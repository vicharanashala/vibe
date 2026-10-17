import { useCallback } from 'react';
import {
  ChatMessageResponse,
  EscalateQuestionRequest,
} from '@/modules/supportChat/types';

// VITE_BASE_URL already ends in the API prefix (e.g. http://localhost:4001/api),
// which is why paths below start at the resource, not at /api.
const API_BASE = import.meta.env.VITE_BASE_URL ?? '';

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('firebase-auth-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
        `${API_BASE}/support/chat/message?${queryParams.toString()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
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
        `${API_BASE}/support/chat/history?limit=${limit}`,
        {
          headers: authHeaders(),
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
      const response = await fetch(`${API_BASE}/support/chat/${questionId}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Question API error: ${response.statusText}`);
      }

      return response.json();
    },
    []
  );

  /**
   * Files a technical-issue report against a question the assistant could not
   * answer. Resubmitting replaces the earlier report rather than opening a
   * second ticket.
   */
  const submitEscalation = useCallback(
    async (questionId: string, request: EscalateQuestionRequest) => {
      const response = await fetch(
        `${API_BASE}/support/chat/${questionId}/escalate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        throw new Error(`Escalation API error: ${response.statusText}`);
      }

      return response.json();
    },
    []
  );

  const rateResolution = useCallback(
    async (questionId: string, rating: 'helpful' | 'not_helpful') => {
      const response = await fetch(
        `${API_BASE}/support/chat/${questionId}/rate`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
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
    submitEscalation,
    rateResolution,
  };
}
