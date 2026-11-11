import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { FEEDBACK, signInAdmin, studio } from '@/test/studio';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

/** The feedback fixture's section: "Short reading" (BLOG) then "Feedback". */
const loc = FEEDBACK;
const lessonUrl = (search: string) =>
  `/admin/courses/${loc.courseId}/${loc.versionId}/lesson?module=${loc.moduleId}&section=${loc.sectionId}&${search}`;
const [reading, feedback] = studio.feedbackSectionItems;
const ITEMS = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items';
const MOVE = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items/{itemId}/move';

/** jsdom has no layout: lists contain their rows, rows get a box from their place among siblings. */
function layoutRows() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.tagName === 'UL' || this.tagName === 'OL')
      return { x: 0, y: 0, top: 0, left: 0, bottom: 10000, right: 300, width: 300, height: 10000, toJSON: () => ({}) } as DOMRect;
    const i = this.parentElement ? Array.prototype.indexOf.call(this.parentElement.children, this) : 0;
    const top = i * 40;
    return { x: 0, y: top, top, left: 0, bottom: top + 32, right: 300, width: 300, height: 32, toJSON: () => ({}) } as DOMRect;
  });
}

beforeEach(() => {
  resetSession();
  signInAdmin();
  layoutRows();
});
afterEach(() => vi.restoreAllMocks());

describe('placing lessons from the editor', () => {
  it('creates a lesson started with “Add below” right after that lesson', async () => {
    const user = userEvent.setup();
    api.POST.mockImplementation(async () => ok({ createdItem: { _id: 'new-video' } }, 201));
    renderApp(lessonUrl(`type=VIDEO&after=${reading._id}`));
    await user.type(await screen.findByLabelText('YouTube link'), 'https://youtu.be/shs0KM3wKv8');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('End'), '4:30');
    await user.type(screen.getByLabelText('Title'), 'Hash tables');
    await user.type(screen.getByLabelText('Subtitle'), 'A short walk-through');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        ITEMS,
        expect.objectContaining({ body: expect.objectContaining({ type: 'VIDEO', afterItemId: reading._id }) }),
      ),
    );
  });

  it('creates at the end when no position was chosen', async () => {
    const user = userEvent.setup();
    api.POST.mockImplementation(async () => ok({ createdItem: { _id: 'new-video' } }, 201));
    renderApp(lessonUrl('type=VIDEO'));
    await user.type(await screen.findByLabelText('YouTube link'), 'https://youtu.be/shs0KM3wKv8');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('End'), '4:30');
    await user.type(screen.getByLabelText('Title'), 'Hash tables');
    await user.type(screen.getByLabelText('Subtitle'), 'A short walk-through');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.POST).toHaveBeenCalledWith(ITEMS, expect.anything()));
    const body = api.POST.mock.calls.find(([p]) => p === ITEMS)![1].body;
    expect(body).not.toHaveProperty('afterItemId');
    expect(body).not.toHaveProperty('beforeItemId');
  });

  it('reorders lessons by dragging in the editor outline', async () => {
    const user = userEvent.setup();
    renderApp(lessonUrl(`item=${reading._id}`));
    const handle = await screen.findByRole('button', { name: `Drag to reorder ${feedback.name}` });
    handle.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    await waitFor(() => expect(api.PUT.mock.calls.filter(([p]) => p === MOVE)).toHaveLength(1));
    const [, request] = api.PUT.mock.calls.filter(([p]) => p === MOVE)[0];
    expect(request.params.path.itemId).toBe(feedback._id);
    expect(request.body).toEqual({ beforeItemId: reading._id });
  });

  it('adds a lesson above or below from a lesson’s menu in the outline', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { router } = renderApp(lessonUrl(`item=${reading._id}`));
    await user.click(await screen.findByRole('button', { name: `${feedback.name}: actions` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Add above' }));
    (await screen.findByRole('menuitem', { name: 'Quiz' })).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toMatchObject({ type: 'QUIZ', before: feedback._id }));
    await user.click(await screen.findByRole('button', { name: `${reading.name}: actions` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Add below' }));
    (await screen.findByRole('menuitem', { name: 'Video' })).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toMatchObject({ type: 'VIDEO', after: reading._id }));
  });

  it('moves a lesson up or down a place from its menu in the outline', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderApp(lessonUrl(`item=${reading._id}`));
    await user.click(await screen.findByRole('button', { name: `${reading.name}: actions` }));
    expect(await screen.findByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'Move down' }));
    await waitFor(() => expect(api.PUT.mock.calls.filter(([p]) => p === MOVE)).toHaveLength(1));
    const [, request] = api.PUT.mock.calls.filter(([p]) => p === MOVE)[0];
    expect(request.params.path.itemId).toBe(reading._id);
    expect(request.body).toEqual({ afterItemId: feedback._id });
  });
});
