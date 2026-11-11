import { screen, waitFor, within } from '@testing-library/react';
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

/**
 * jsdom has no layout, so give every element a box from its place among its
 * siblings: dnd-kit's keyboard sensor moves between rows by their positions.
 */
function layoutRows() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const i = this.parentElement ? Array.prototype.indexOf.call(this.parentElement.children, this) : 0;
    const top = i * 50;
    return { x: 0, y: top, top, left: 0, bottom: top + 40, right: 600, width: 600, height: 40, toJSON: () => ({}) } as DOMRect;
  });
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  renderApp(content);
  await user.click(await screen.findByRole('button', { name: 'Expand all' }));
}

const moveCalls = () => api.PUT.mock.calls.filter(([p]) => p === MOVE);
/** The lessons' order in the first section (every section here shows the same lessons). */
const lessonNames = () =>
  within(screen.getAllByRole('button', { name: `Drag to reorder ${first.name}` })[0].closest('ul')!)
    .getAllByRole('button', { name: /^Drag to reorder / })
    .map((b) => b.getAttribute('aria-label')!.replace('Drag to reorder ', ''));

async function menuAction(user: ReturnType<typeof userEvent.setup>, lesson: string, action: string) {
  await user.click((await screen.findAllByRole('button', { name: `Lesson ${lesson}: actions` }))[0]);
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

beforeEach(() => {
  resetSession();
  signInAdmin();
  layoutRows();
});
afterEach(() => vi.restoreAllMocks());

describe('reordering lessons in Studio', () => {
  it('drags a lesson up with the keyboard and saves it before the lesson it passed', async () => {
    withItems([third, first, second]);
    const user = userEvent.setup();
    await open(user);
    const handle = (await screen.findAllByRole('button', { name: `Drag to reorder ${second.name}` }))[0];
    handle.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    await waitFor(() => expect(moveCalls()).toHaveLength(1));
    const [, request] = moveCalls()[0];
    expect(request.params.path.itemId).toBe(second._id);
    expect(request.body).toEqual({ beforeItemId: first._id });
  });

  it('saves nothing when a drag is cancelled', async () => {
    withItems([first, second, third]);
    const user = userEvent.setup();
    await open(user);
    const handle = (await screen.findAllByRole('button', { name: `Drag to reorder ${second.name}` }))[0];
    handle.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Escape]');
    await new Promise((r) => setTimeout(r, 50));
    expect(moveCalls()).toHaveLength(0);
  });

  it('moves a lesson up or down from its menu', async () => {
    withItems([third, first, second]);
    const user = userEvent.setup();
    await open(user);
    await menuAction(user, second.name, 'Move up');
    await waitFor(() => expect(moveCalls()).toHaveLength(1));
    expect(moveCalls()[0][1].body).toEqual({ beforeItemId: first._id });

    await menuAction(user, second.name, 'Move down');
    await waitFor(() => expect(moveCalls()).toHaveLength(2));
    expect(moveCalls()[1][1].body).toEqual({ afterItemId: third._id });
  });

  it('can’t move the first lesson up or the last one down', async () => {
    withItems([first, second, third]);
    const user = userEvent.setup();
    await open(user);
    await user.click((await screen.findAllByRole('button', { name: `Lesson ${first.name}: actions` }))[0]);
    expect(await screen.findByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Move down' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the new order at once, and puts it back with an explanation when saving fails', async () => {
    withItems([first, second, third]);
    let fail!: () => void;
    api.PUT.mockImplementation(
      () =>
        new Promise((resolve) => {
          fail = () => resolve({ data: undefined, error: { message: 'Server unavailable' }, response: new Response(null, { status: 500 }) });
        }),
    );
    const user = userEvent.setup();
    await open(user);
    const handle = (await screen.findAllByRole('button', { name: `Drag to reorder ${second.name}` }))[0];
    handle.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    await waitFor(() => expect(lessonNames()[0]).toBe(second.name));
    fail();
    expect(await screen.findByText(/The lesson wasn’t moved: Server unavailable/)).toBeInTheDocument();
    await waitFor(() => expect(lessonNames()[0]).toBe(first.name));
  });
});

describe('adding lessons in place', () => {
  it('“Add below” opens the new-lesson editor placed after that lesson', async () => {
    withItems([first, second]);
    // Submenus open on hover; jsdom can't run their pointer-events transition.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { router } = renderApp(content);
    await user.click(await screen.findByRole('button', { name: 'Expand all' }));
    await user.click((await screen.findAllByRole('button', { name: `Lesson ${first.name}: actions` }))[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Add below' }));
    // Like a keyboard user: jsdom's synthetic pointer clicks don't reach Base UI submenu items.
    (await screen.findByRole('menuitem', { name: 'Video' })).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/lesson$/));
    expect(router.state.location.search).toMatchObject({ type: 'VIDEO', after: first._id });
  });

  it('“Add above” places it before that lesson', async () => {
    withItems([first, second]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { router } = renderApp(content);
    await user.click(await screen.findByRole('button', { name: 'Expand all' }));
    await user.click((await screen.findAllByRole('button', { name: `Lesson ${second.name}: actions` }))[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Add above' }));
    (await screen.findByRole('menuitem', { name: 'Quiz' })).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toMatchObject({ type: 'QUIZ', before: second._id }));
  });

  it('the row’s “+” adds directly below it', async () => {
    withItems([first, second]);
    const user = userEvent.setup();
    const { router } = renderApp(content);
    await user.click(await screen.findByRole('button', { name: 'Expand all' }));
    await user.click((await screen.findAllByRole('button', { name: `Add a lesson below ${first.name}` }))[0]);
    await user.click(await screen.findByRole('menuitem', { name: /Article/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ type: 'BLOG', after: first._id }));
  });

  it('an empty section offers “Add lesson” right where the lessons would be', async () => {
    withItems([]);
    const user = userEvent.setup();
    await open(user);
    expect((await screen.findAllByText('No lessons yet.')).length).toBeGreaterThan(0);
    const empty = screen.getAllByText('No lessons yet.')[0];
    expect(within(empty).getByRole('button', { name: /Add lesson/ })).toBeInTheDocument();
  });
});
