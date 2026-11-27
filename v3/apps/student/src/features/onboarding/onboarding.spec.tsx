import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { resetSession, signInStudent, STUDENT } from '@/test/session';

import { needsOnboarding, readOnboarding } from './onboarding-state';

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));
vi.mock('@vibe/proctoring', async (orig) => ({
  ...(await orig<object>()),
  runMediaChecks: () => [],
}));

const stream = {
  getTracks: () => [],
  getVideoTracks: () => [],
  getAudioTracks: () => [],
};

beforeEach(() => {
  resetSession();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
});

describe('needsOnboarding', () => {
  const user = (creationTime?: string, lastSignInTime?: string) => ({
    uid: 'u1',
    metadata: { creationTime, lastSignInTime },
  });
  const created = 'Mon, 05 Oct 2026 10:00:00 GMT';

  it('is true on the first sign-in, seconds after the account was made', () => {
    expect(
      needsOnboarding(user(created, 'Mon, 05 Oct 2026 10:00:04 GMT')),
    ).toBe(true);
  });

  it('is false on a later sign-in, even with nothing stored in this browser', () => {
    expect(
      needsOnboarding(user(created, 'Mon, 05 Oct 2026 10:06:00 GMT')),
    ).toBe(false);
  });

  it('is false once finished here, even during the first sign-in', () => {
    localStorage.setItem(
      'vibe:onboarding:u1',
      JSON.stringify({ completedAt: '2026-10-05T10:01:00Z' }),
    );
    expect(
      needsOnboarding(user(created, 'Mon, 05 Oct 2026 10:00:04 GMT')),
    ).toBe(false);
  });

  it('does not block anyone when the times are missing', () => {
    expect(needsOnboarding(user())).toBe(false);
  });
});

describe('finishing the camera and microphone check from home', () => {
  async function openCheck() {
    const user = userEvent.setup();
    signInStudent();
    const { router } = renderApp('/home');
    await user.click(
      await screen.findByRole('link', {
        name: /Check your camera and microphone/,
      }),
    );
    await screen.findByRole('heading', {
      name: 'Check your camera and microphone',
    });
    return { user, router };
  }

  it('opens only that step, not the name and look steps', async () => {
    await openCheck();
    expect(
      screen.queryByRole('heading', { name: 'What should we call you?' }),
    ).toBeNull();
    expect(
      screen.queryByRole('progressbar', { name: 'Onboarding progress' }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('returns home with the step ticked once the check passes', async () => {
    const { user, router } = await openCheck();
    await user.click(
      screen.getByRole('button', { name: /camera|microphone|check|allow/i }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
    expect(readOnboarding(STUDENT.uid).mediaCheckPassedAt).toBeTruthy();
    expect(await screen.findByText('Getting started')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Check your camera and microphone/ }),
    ).toBeNull();
  });

  it('returns home with the step still open when skipped', async () => {
    const { user, router } = await openCheck();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
    expect(readOnboarding(STUDENT.uid).mediaCheckPassedAt).toBeUndefined();
    expect(
      await screen.findByRole('link', {
        name: /Check your camera and microphone/,
      }),
    ).toBeInTheDocument();
  });
});
