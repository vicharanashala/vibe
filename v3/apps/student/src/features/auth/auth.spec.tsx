import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, firebaseAuthFns, resetSession, signInStudent } from '@/test/session';

import { splitName } from './auth-provider';
import { PASSWORD_RULES } from './signup-page';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

beforeEach(() => resetSession());

describe('auth routing', () => {
  it('sends signed-out visitors from the app to log in, keeping where they were going', async () => {
    const { router } = renderApp('/courses');
    await screen.findByRole('heading', { name: 'Welcome back to ViBe' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/courses' });
  });

  it('sends signed-in students away from the auth pages', async () => {
    signInStudent();
    const { router } = renderApp('/login');
    await screen.findByRole('heading', { name: /welcome back, asha/i });
    expect(router.state.location.pathname).toBe('/home');
  });

  it('shows onboarding first to students who have not finished it', async () => {
    signInStudent({ onboarded: false });
    const { router } = renderApp('/home');
    await screen.findByRole('heading', { name: 'What should we call you?' });
    expect(router.state.location.pathname).toBe('/onboarding');
  });
});

describe('log in', () => {
  it('signs in with Firebase and continues to onboarding for a first visit', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login');
    await user.type(await screen.findByLabelText('Email address'), 'student@vibe.local');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(firebaseAuthFns.signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'student@vibe.local', 'Password123!');
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
  });

  it('explains wrong credentials in plain language', async () => {
    firebaseAuthFns.signInWithEmailAndPassword.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email address'), 'student@vibe.local');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match');
  });
});

describe('sign up', () => {
  it('only enables "Create account" once every password rule passes, then registers via the backend', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/signup');
    await user.type(await screen.findByLabelText('Full name'), 'Asha Rani Student');
    await user.type(screen.getByLabelText('Email address'), 'asha@vibe.local');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const create = await screen.findByRole('button', { name: 'Create account' });
    await user.type(screen.getByLabelText('Password'), 'weakpass');
    expect(create).toBeDisabled();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'Str0ng!pass');
    expect(create).toBeEnabled();
    await user.click(create);

    expect(api.POST).toHaveBeenCalledWith('/api/auth/signup', {
      body: {
        email: 'asha@vibe.local',
        password: 'Str0ng!pass',
        firstName: 'Asha',
        lastName: 'Rani Student',
        recaptchaToken: 'NO_CAPTCHA',
      },
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
  });

  it('rejects names the backend would refuse', async () => {
    const user = userEvent.setup();
    renderApp('/signup');
    await user.type(await screen.findByLabelText('Full name'), 'R2-D2');
    await user.type(screen.getByLabelText('Email address'), 'r2@vibe.local');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('letters and spaces');
  });
});

describe('helpers', () => {
  it('splits full names the way the backend stores them', () => {
    expect(splitName('  Asha  ')).toEqual({ firstName: 'Asha', lastName: '' });
    expect(splitName('Asha Rani Student')).toEqual({ firstName: 'Asha', lastName: 'Rani Student' });
  });

  it('password rules match the documented backend policy', () => {
    const passes = (p: string) => PASSWORD_RULES.every((r) => r.test(p));
    expect(passes('Str0ng!pass')).toBe(true);
    expect(passes('str0ng!pass')).toBe(false);
    expect(passes('Strong!pass')).toBe(false);
    expect(passes('Str0ngpass')).toBe(false);
    expect(passes('S0!a')).toBe(false);
  });
});
