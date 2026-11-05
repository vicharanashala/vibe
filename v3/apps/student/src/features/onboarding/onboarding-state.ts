import type { User } from 'firebase/auth';

/**
 * The backend has no field for onboarding progress, so it is remembered per
 * browser, keyed by Firebase uid. A camera check also only says something about
 * this device, so it belongs here anyway.
 */
export interface OnboardingState {
  completedAt?: string;
  mediaCheckPassedAt?: string;
}

const key = (uid: string) => `vibe:onboarding:${uid}`;

export function readOnboarding(uid: string): OnboardingState {
  try {
    return JSON.parse(localStorage.getItem(key(uid)) ?? '{}') as OnboardingState;
  } catch {
    return {};
  }
}

export function writeOnboarding(uid: string, patch: Partial<OnboardingState>) {
  try {
    localStorage.setItem(key(uid), JSON.stringify({ ...readOnboarding(uid), ...patch }));
  } catch {
    // storage unavailable — onboarding will simply show again next time
  }
}

/**
 * The backend creates the Firebase account just before the first sign-in, so
 * the two times are seconds apart. A wider gap means this is a later sign-in.
 */
const FIRST_SIGN_IN_WINDOW_MS = 5 * 60 * 1000;

/**
 * Onboarding is only for an account's first sign-in. This browser's record can't
 * decide that alone: it is empty on every new device, new domain or private
 * window, which would send returning students through onboarding each time.
 */
export function needsOnboarding(user: Pick<User, 'uid' | 'metadata'>): boolean {
  if (readOnboarding(user.uid).completedAt) return false;
  const created = Date.parse(user.metadata.creationTime ?? '');
  const lastSignIn = Date.parse(user.metadata.lastSignInTime ?? '');
  // Unknown times compare false: never block someone on missing data.
  return lastSignIn - created <= FIRST_SIGN_IN_WINDOW_MS;
}
