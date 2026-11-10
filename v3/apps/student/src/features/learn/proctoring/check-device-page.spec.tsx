import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { resetSession, signInStudent } from '@/test/session';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));
vi.mock('./diagnostics', async (orig) => ({
  ...(await orig<object>()),
  runDiagnostics: async function* () {
    yield { id: 'webgl', label: 'WebGL graphics', status: 'fail', detail: 'Not available.', fix: 'Turn on hardware acceleration.' };
  },
}));

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('Check my device', () => {
  it('runs the checks on its own page, without opening a lesson', async () => {
    renderApp('/check-device');
    expect(await screen.findByRole('heading', { name: 'Check my device' })).toBeInTheDocument();
    expect(await screen.findByRole('listitem', { name: 'WebGL graphics' })).toHaveTextContent('Turn on hardware acceleration.');
  });

  it('is linked from the profile page', async () => {
    const { router } = renderApp('/profile');
    await userEvent.click(await screen.findByRole('link', { name: /Check my device/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/check-device'));
    expect(await screen.findByRole('heading', { name: 'Check my device' })).toBeInTheDocument();
  });
});
