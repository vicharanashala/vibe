import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession } from '@/test/session';
import { SAMPLE, signInAdmin } from '@/test/studio';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const content = `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}?tab=content`;
const ITEMS = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items';
const MOVE = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items/{itemId}/move';

const [first, second] = fixtures.sectionItems;
// A third lesson, so the middle row can go both ways. The list arrives unsorted on purpose.
const third = { ...second, _id: '6ac670a94ec7ef17228a73ff', name: 'Third lesson', order: '0|i0000f:' };

function withItems(items: unknown[]) {
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => (p === ITEMS ? ok(items) : fallback(p, ...rest)));
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  renderApp(content);
  await user.click(await screen.findByRole('button', { name: 'Expand all' }));
}

const moveCalls = () => api.PUT.mock.calls.filter(([p]) => p === MOVE);

beforeEach(() => {
  resetSession();
  signInAdmin();
});

describe('reordering lessons in Studio', () => {
  it('moves a lesson up, right before the one above it', async () => {
    withItems([third, first, second]);
    const user = userEvent.setup();
    await open(user);
    await user.click((await screen.findAllByRole('button', { name: `Move ${second.name} up` }))[0]);
    await waitFor(() => expect(moveCalls()).toHaveLength(1));
    const [, request] = moveCalls()[0];
    expect(request.params.path.itemId).toBe(second._id);
    expect(request.body).toEqual({ beforeItemId: first._id });
  });

  it('moves a lesson down, right after the one below it', async () => {
    withItems([third, first, second]);
    const user = userEvent.setup();
    await open(user);
    await user.click((await screen.findAllByRole('button', { name: `Move ${second.name} down` }))[0]);
    await waitFor(() => expect(moveCalls()).toHaveLength(1));
    const [, request] = moveCalls()[0];
    expect(request.params.path.itemId).toBe(second._id);
    expect(request.body).toEqual({ afterItemId: third._id });
  });

  it('can’t move the first lesson up or the last one down', async () => {
    withItems([first, second, third]);
    const user = userEvent.setup();
    await open(user);
    expect((await screen.findAllByRole('button', { name: `Move ${first.name} up` }))[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: `Move ${first.name} down` })[0]).toBeEnabled();
    expect(screen.getAllByRole('button', { name: `Move ${third.name} down` })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: `Move ${third.name} up` })[0]).toBeEnabled();
  });

  it('offers nothing when a section has one lesson', async () => {
    withItems([first]);
    const user = userEvent.setup();
    await open(user);
    await screen.findAllByRole('button', { name: first.name });
    expect(screen.queryByRole('button', { name: `Move ${first.name} up` })).not.toBeInTheDocument();
  });

  it('reloads the section’s lessons after a move', async () => {
    withItems([first, second, third]);
    const user = userEvent.setup();
    await open(user);
    await screen.findAllByRole('button', { name: `Move ${second.name} up` });
    const reads = () => api.GET.mock.calls.filter(([p]) => p === ITEMS).length;
    const before = reads();
    await user.click(screen.getAllByRole('button', { name: `Move ${second.name} up` })[0]);
    await waitFor(() => expect(reads()).toBeGreaterThan(before));
  });

  it('explains a failed move', async () => {
    withItems([first, second, third]);
    api.PUT.mockImplementation(async () => ({
      data: undefined,
      error: { message: 'Server unavailable' },
      response: new Response(null, { status: 500 }),
    }));
    const user = userEvent.setup();
    await open(user);
    await user.click((await screen.findAllByRole('button', { name: `Move ${second.name} up` }))[0]);
    expect(await screen.findByText(/The lesson wasn’t moved: Server unavailable/)).toBeInTheDocument();
  });
});
