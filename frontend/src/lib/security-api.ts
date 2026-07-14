import { apiClient } from './api-client';

export interface HoneypotTriggerPayload {
  sessionId?: string;
  currentRoute?: string;
  timestamp: string;
}

export interface HoneypotTriggerResponse {
  status: 'success' | 'error';
  message: string;
}

export const securityApi = {
  recordHoneypotTrigger: async (
    payload: HoneypotTriggerPayload,
  ): Promise<HoneypotTriggerResponse> => {
    try {
      const response = await apiClient.post<HoneypotTriggerResponse>(
        '/api/security/honeypot-triggered',
        payload,
      );
      return response.data;
    } catch (error) {
      // Silently fail - honeypot detection should not affect UX
      console.log('[SECURITY] Honeypot request failed:', error);
      return {
        status: 'success',
        message: 'Request processed',
      };
    }
  },
};
