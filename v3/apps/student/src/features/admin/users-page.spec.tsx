import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { signInAdmin, studio, studioGet } from '@/test/studio';

import { objectIdTime } from './queries';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const [template] = studio.users.users;

/** An ObjectId (hex) whose embedded creation time is `ms`. */
const idAt = (ms: number, n: number) => Math.floor(ms / 1000).toString(16).padStart(8, '0') + n.toString(16).padStart(16, '0');

/** `count` learners shaped like the captured record, joined one day apart, newest first. */
function makeUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...template,
    _id: idAt(NOW - i * DAY, i),
    firstName: `Learner${i}`,
    lastName: 'Test',
    email: `learner${i}@vibe.local`,
    roles: 'user',
  }));
}

function serveUsers(users: unknown[]) {
  api.GET.mockImplementation(async (path: string, opts?: never) => (path === '/api/users/' ? ok({ users }) : studioGet(path, opts)));
}

const rowsOf = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

beforeEach(() => {
  resetSession();
  signInAdmin();
});

describe('Users page', () => {
  it('reads the join time from the ObjectId', () => {
    expect(objectIdTime('6ac6703d4ec7ef17228a73bd')).toBe(0x6ac6703d * 1000);
    expect(objectIdTime('not-an-object-id')).toBeNull();
  });

  it('shows 50 people a page, newest first, and pages through the rest', async () => {
    serveUsers(makeUsers(120));
    const user = userEvent.setup();
    renderApp('/admin/users');
    expect(await screen.findByText('1–50 of 120')).toBeInTheDocument();
    expect(rowsOf()).toHaveLength(50);
    expect(within(rowsOf()[0]).getByText('learner0@vibe.local')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('51–100 of 120')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('101–120 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });

  it('sorts oldest first and filters by when people joined', async () => {
    serveUsers(makeUsers(120));
    const user = userEvent.setup();
    renderApp('/admin/users');
    await screen.findByText('1–50 of 120');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'oldest');
    expect(within(rowsOf()[0]).getByText('learner119@vibe.local')).toBeInTheDocument();

    // Joined 0..6 days ago fall inside "last 7 days"; 7 days ago is just outside.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Joined' }), '7');
    expect(screen.getByText('1–7 of 7')).toBeInTheDocument();
  });

  it('searches by name or email and goes back to page 1', async () => {
    serveUsers(makeUsers(120));
    const user = userEvent.setup();
    renderApp('/admin/users');
    await screen.findByText('1–50 of 120');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    await user.type(screen.getByRole('textbox', { name: 'Search users' }), 'learner11');
    // learner11 and learner110..119
    expect(await screen.findByText('1–11 of 11')).toBeInTheDocument();
  });
});
