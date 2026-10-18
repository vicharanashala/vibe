/**
 * Runtime configuration from Vite env vars (see .env.example).
 * Local development defaults to the local backend + Firebase Auth emulator.
 */
const e = import.meta.env;
const projectId = (e.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? 'demo-vibe';

export const env = {
  /** Backend origin. Empty = same origin (the Vite dev server proxies /api to the local backend). */
  apiBaseUrl: (e.VITE_API_BASE_URL as string | undefined) ?? '',
  firebase: {
    apiKey: (e.VITE_FIREBASE_API_KEY as string | undefined) ?? 'demo-api-key',
    // Required for Google pop-up sign-in (auth/auth-domain-config-required otherwise).
    authDomain: (e.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || `${projectId}.firebaseapp.com`,
    projectId,
    appId: e.VITE_FIREBASE_APP_ID as string | undefined,
  },
  /** Google reCAPTCHA v2 (same variables as the current app). Off unless VITE_IS_RECAPTCHA_ENABLED is "true". */
  recaptcha: {
    enabled: e.VITE_IS_RECAPTCHA_ENABLED === 'true' && !!e.VITE_RECAPTCHA_SITE_KEY,
    siteKey: (e.VITE_RECAPTCHA_SITE_KEY as string | undefined) ?? '',
  },
  /**
   * When set, Firebase Auth talks to the emulator. "same-origin" routes it through
   * the Vite dev proxy (works over an SSH tunnel); a URL points at it directly.
   */
  authEmulatorUrl:
    e.VITE_FIREBASE_AUTH_EMULATOR_URL === 'same-origin'
      ? window.location.origin
      : (e.VITE_FIREBASE_AUTH_EMULATOR_URL as string | undefined),
} as const;
