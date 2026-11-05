import { createApiClient } from '@vibe/api';

import { env } from './env';
import { auth } from './firebase';

export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  getToken: async (options) =>
    auth.currentUser ? auth.currentUser.getIdToken(options?.forceRefresh) : null,
});
