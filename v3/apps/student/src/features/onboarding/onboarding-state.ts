/**
 * The backend has no field for onboarding progress, so it is remembered per
 * browser, keyed by Firebase uid. Losing it only means seeing onboarding again.
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
