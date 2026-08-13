import { useCallback } from 'react';
import { AdminResponseRequest, IFAQ, FAQCategory } from '@/modules/supportChat/types';

const API_BASE = import.meta.env.VITE_BASE_URL || 'http://localhost:3001';

export default function useAdminSupport() {
  const getToken = () => localStorage.getItem('authToken');

  const getDashboard = useCallback(
    async (courseId?: string, startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`${API_BASE}/api/admin/support/dashboard?${params}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard');
      return response.json();
    },
    []
  );

  const getQuestions = useCallback(
    async (status?: string, page: number = 1, limit: number = 50, courseId?: string) => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (courseId) params.append('courseId', courseId);

      const response = await fetch(`${API_BASE}/api/admin/support/questions?${params}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch questions');
      return response.json();
    },
    []
  );

  const respondToQuestion = useCallback(
    async (questionId: string, request: AdminResponseRequest) => {
      const response = await fetch(
        `${API_BASE}/api/admin/support/questions/${questionId}/respond`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) throw new Error('Failed to respond to question');
      return response.json();
    },
    []
  );

  const resolveQuestion = useCallback(
    async (questionId: string) => {
      const response = await fetch(
        `${API_BASE}/api/admin/support/questions/${questionId}/resolve`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to resolve question');
      return response.json();
    },
    []
  );

  const getAllFAQs = useCallback(
    async (category?: FAQCategory) => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);

      const response = await fetch(`${API_BASE}/api/admin/support/faqs?${params}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch FAQs');
      return response.json();
    },
    []
  );

  const createFAQ = useCallback(
    async (faq: Omit<IFAQ, '_id' | 'createdAt' | 'updatedAt' | 'embedding' | 'createdBy'>) => {
      const response = await fetch(`${API_BASE}/api/admin/support/faqs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(faq),
      });

      if (!response.ok) throw new Error('Failed to create FAQ');
      return response.json();
    },
    []
  );

  const updateFAQ = useCallback(
    async (faqId: string, updates: Partial<IFAQ>) => {
      const response = await fetch(`${API_BASE}/api/admin/support/faqs/${faqId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update FAQ');
      return response.json();
    },
    []
  );

  const deleteFAQ = useCallback(
    async (faqId: string) => {
      const response = await fetch(`${API_BASE}/api/admin/support/faqs/${faqId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete FAQ');
      return response.json();
    },
    []
  );

  return {
    getDashboard,
    getQuestions,
    respondToQuestion,
    resolveQuestion,
    getAllFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ,
  };
}
