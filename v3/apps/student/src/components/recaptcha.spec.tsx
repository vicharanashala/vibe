import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import {
  api,
  firebaseAuthFns,
  fixtures,
  resetSession,
  signInStudent,
} from '@/test/session';

import type {} from './recaptcha'; // window.grecaptcha type

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));
// reCAPTCHA switched on, as in a deployment with VITE_IS_RECAPTCHA_ENABLED=true.
vi.mock('@/lib/env', async (orig) => {
  const { env } = await orig<typeof import('@/lib/env')>();
  return { env: { ...env, recaptcha: { enabled: true, siteKey: 'site-key' } } };
});

/** Stands in for Google's script: records each widget so a test can "tick" it. */
const widgets: { sitekey: string; callback: (token: string) => void }[] = [];
const tick = (token: string) => act(() => widgets.at(-1)!.callback(token));

beforeEach(() => {
  resetSession();
  widgets.length = 0;
  window.grecaptcha = {
    render: (_el, opts) => {
      widgets.push(opts);
      return widgets.length;
    },
  };
});
afterEach(() => {
  delete window.grecaptcha;
});

describe('reCAPTCHA', () => {
  it('logs in only after the check, verifying the token with the backend first', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(
      await screen.findByLabelText('Email address'),
      'student@vibe.local',
    );
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    const submit = screen.getByRole('button', { name: 'Continue' });
    await waitFor(() => expect(widgets).toHaveLength(1));
    expect(widgets[0].sitekey).toBe('site-key');
    expect(submit).toBeDisabled();

    tick('token-1');
    await user.click(submit);
    await waitFor(() =>
      expect(firebaseAuthFns.signInWithEmailAndPassword).toHaveBeenCalled(),
    );
    expect(api.POST).toHaveBeenCalledWith('/api/auth/login', {
      body: {
        email: 'student@vibe.local',
        password: 'Password123!',
        recaptchaToken: 'token-1',
      },
    });
  });

  it('shows the backend’s reason and asks for a fresh check when it rejects the token', async () => {
    api.POST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'reCAPTCHA verification failed. Please try again.' },
      response: new Response(null, { status: 400 }),
    });
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(
      await screen.findByLabelText('Email address'),
      'student@vibe.local',
    );
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await waitFor(() => expect(widgets).toHaveLength(1));
    tick('used-token');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'reCAPTCHA verification failed',
    );
    expect(firebaseAuthFns.signInWithEmailAndPassword).not.toHaveBeenCalled();
    // Tokens are single-use: a new widget, and the button waits for it.
    await waitFor(() => expect(widgets).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('sends the token with sign-up, then signs in without spending it again', async () => {
    const user = userEvent.setup();
    renderApp('/signup');
    await user.type(await screen.findByLabelText('Full name'), 'Asha Student');
    await user.type(screen.getByLabelText('Email address'), 'asha@vibe.local');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText('Password'), 'Str0ng!pass');
    await waitFor(() => expect(widgets).toHaveLength(1));
    expect(
      screen.getByRole('button', { name: 'Create account' }),
    ).toBeDisabled();

    tick('token-2');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(firebaseAuthFns.signInWithEmailAndPassword).toHaveBeenCalled(),
    );
    expect(api.POST).toHaveBeenCalledWith('/api/auth/signup', {
      body: {
        email: 'asha@vibe.local',
        password: 'Str0ng!pass',
        firstName: 'Asha',
        lastName: 'Student',
        recaptchaToken: 'token-2',
      },
    });
    expect(api.POST).not.toHaveBeenCalledWith(
      '/api/auth/login',
      expect.anything(),
    );
  });

  it('holds course registration until the check is done', async () => {
    signInStudent();
    renderApp(`/register/${fixtures.registrationDetails.course.versions[0]}`);
    const register = await screen.findByRole('button', { name: 'Register' });
    await waitFor(() => expect(widgets).toHaveLength(1));
    expect(register).toBeDisabled();
    tick('token-3');
    await waitFor(() => expect(register).toBeEnabled());
  });
});
