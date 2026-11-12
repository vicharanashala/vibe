import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@vibe/api';

import { renderApp } from '@/test/render-app';
import lockedByModule from '@/test/fixtures/content-locked.json';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';
import { SAMPLE, signInAdmin } from '@/test/studio';

import { contentLockRefusal, resolveContentLock } from './content-lock';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
const lessonUrl = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}/${path.item.id}`;
const courseUrl = `/courses/${enrollment.courseId}/${enrollment.courseVersionId}`;
const studio = `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}?tab=content`;
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';
const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';
const VERSION = '/api/courses/versions/{versionId}';
const ITEMS = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items';
const MODULE_LOCK = '/api/courses/versions/{versionId}/modules/{moduleId}/lock';
const ITEM_LOCK = '/api/courses/versions/{versionId}/items/{itemId}/lock';
const START = '/api/users/progress/courses/{courseId}/versions/{versionId}/start';

const LOCKED_TITLE = 'Locked by your instructor';
const refused = (body: unknown = lockedByModule) => ({
  data: undefined,
  error: body,
  response: new Response(null, { status: 403 }),
});

function withGet(overrides: Record<string, unknown>) {
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => {
    if (!(p in overrides)) return fallback(p, ...rest);
    const v = overrides[p];
    return typeof v === 'function' ? (v as (o: unknown) => unknown)(rest[0]) : ok(v);
  });
}

function setPrimaryTouch(touch: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: touch && query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function versionWithFirstModuleLocked() {
  const version = structuredClone(fixtures.courseVersion);
  (version.modules[0] as { isLocked?: boolean }).isLocked = true;
  return version;
}

beforeEach(() => {
  resetSession();
  setPrimaryTouch(false);
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
});

describe('resolveContentLock', () => {
  it('follows item > section > module, open when nothing is set', () => {
    expect(resolveContentLock({}, {}, {})).toEqual({ locked: false, source: 'default' });
    expect(resolveContentLock({ isLocked: null }, {}, { isLocked: true })).toEqual({ locked: true, source: 'module' });
    expect(resolveContentLock({}, { isLocked: true }, { isLocked: false })).toEqual({ locked: true, source: 'section' });
    expect(resolveContentLock({ isLocked: false }, {}, { isLocked: true })).toEqual({ locked: false, source: 'item' });
  });
});

describe('contentLockRefusal', () => {
  it('recognises the backend’s lock refusal and nothing else', () => {
    expect(contentLockRefusal(new ApiError(403, 'x', lockedByModule))).toEqual({ source: 'module' });
    expect(contentLockRefusal(new ApiError(403, 'x', { name: 'ForbiddenError' }))).toBeUndefined();
    expect(contentLockRefusal(new ApiError(403, 'x', { name: 'STUDY_MODE_DISABLED' }))).toBeUndefined();
    expect(contentLockRefusal(new Error('network'))).toBeUndefined();
  });
});

describe('locked screen', () => {
  beforeEach(() => signInStudent());

  it('shows in strict mode, naming the level, with a way back and no mode switch', async () => {
    withGet({ [CONSENT]: { signed: true }, [ITEM]: () => refused() });
    renderApp(`${lessonUrl}?track=green`);
    expect(await screen.findByRole('heading', { name: LOCKED_TITLE })).toBeInTheDocument();
    expect(screen.getByText(/Your instructor has locked this module/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the course' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Switch to/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/next lesson/)).not.toBeInTheDocument();
  });

  it('shows in study mode on a phone, instead of continue-on-a-computer', async () => {
    setPrimaryTouch(true);
    withGet({ [CONSENT]: { signed: true }, [ITEM]: () => refused() });
    renderApp(`${lessonUrl}?track=blue`);
    expect(await screen.findByRole('heading', { name: LOCKED_TITLE })).toBeInTheDocument();
    expect(screen.queryByText(/computer/)).not.toBeInTheDocument();
  });

  it('shows for strict mode on a phone too', async () => {
    setPrimaryTouch(true);
    withGet({ [CONSENT]: { signed: true }, [ITEM]: () => refused() });
    renderApp(`${lessonUrl}?track=green`);
    expect(await screen.findByRole('heading', { name: LOCKED_TITLE })).toBeInTheDocument();
  });

  it('leaves the linear “finish the earlier lessons” screen alone', async () => {
    withGet({
      [CONSENT]: { signed: true },
      [ITEM]: () => refused({ name: 'ForbiddenError', message: "You don't have permission to watch this item" }),
    });
    renderApp(`${lessonUrl}?track=green`);
    expect(await screen.findByRole('heading', { name: 'Finish the earlier lessons first' })).toBeInTheDocument();
    expect(screen.queryByText(LOCKED_TITLE)).not.toBeInTheDocument();
  });

  it('appears when a lesson locked while open has its start refused', async () => {
    // The first read succeeds; once start is refused, the lesson refetch is too.
    let locked = false;
    withGet({
      [CONSENT]: { signed: true },
      [ITEM]: () => (locked ? refused() : ok(fixtures.itemVideo)),
    });
    const post = api.POST.getMockImplementation()!;
    api.POST.mockImplementation(async (p: string, ...rest: unknown[]) => {
      if (p !== START) return post(p, ...rest);
      locked = true;
      return refused();
    });
    renderApp(`${lessonUrl}?track=green`);
    expect(await screen.findByRole('heading', { name: LOCKED_TITLE })).toBeInTheDocument();
  });
});

describe('student outline', () => {
  beforeEach(() => signInStudent());

  const firstSectionItems = () => {
    const [first, second] = fixtures.sectionItems;
    return { first, second };
  };

  it('marks a locked lesson, and keeps it listed', async () => {
    const { first, second } = firstSectionItems();
    withGet({ [ITEMS]: [{ ...first, isLocked: true }, second] });
    renderApp(courseUrl);
    const row = (await screen.findAllByText(first.name))[0].closest('li')!;
    expect(within(row).getByLabelText(LOCKED_TITLE)).toBeInTheDocument();
    expect(within(row).getByText(/Locked by your instructor/)).toBeInTheDocument();
    const other = screen.getAllByText(second.name)[0].closest('li')!;
    expect(within(other).queryByLabelText(LOCKED_TITLE)).not.toBeInTheDocument();
  });

  it('keeps the completed mark on a finished lesson that is locked', async () => {
    const { first, second } = firstSectionItems();
    withGet({ [ITEMS]: [{ ...first, isLocked: true, isCompleted: true }, second] });
    renderApp(courseUrl);
    const row = (await screen.findAllByText(first.name))[0].closest('li')!;
    expect(within(row).getByLabelText(LOCKED_TITLE)).toBeInTheDocument();
    expect(within(row).getByText('Completed')).toBeInTheDocument();
  });

  it('shows no lock on a lesson set to open inside a locked module', async () => {
    const { first, second } = firstSectionItems();
    withGet({
      [VERSION]: versionWithFirstModuleLocked(),
      [ITEMS]: [{ ...first, isLocked: false }, second],
    });
    renderApp(courseUrl);
    const row = (await screen.findAllByText(first.name))[0].closest('li')!;
    expect(within(row).queryByLabelText(LOCKED_TITLE)).not.toBeInTheDocument();
    const other = screen.getAllByText(second.name)[0].closest('li')!;
    expect(within(other).getByLabelText(LOCKED_TITLE)).toBeInTheDocument();
  });
});

describe('studio lock controls', () => {
  beforeEach(() => signInAdmin());

  const [firstModule] = fixtures.courseVersion.modules;
  const [firstItem, secondItem] = fixtures.sectionItems;
  // The submenu reports `pointer-events: none` in jsdom while it opens.
  const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

  async function choose(name: string | RegExp, user: ReturnType<typeof userEvent.setup>) {
    const option = await screen.findByRole('menuitemradio', { name });
    option.focus();
    await user.keyboard('{Enter}');
  }

  async function openLockMenu(user: ReturnType<typeof userEvent.setup>, rowLabel: string) {
    await user.click((await screen.findAllByRole('button', { name: `${rowLabel}: actions` }))[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Lock' }));
  }

  it('locks a module', async () => {
    const user = setupUser();
    renderApp(studio);
    await openLockMenu(user, `Module ${firstModule.name}`);
    await choose(/Locked: closed to students/, user);
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(MODULE_LOCK, {
        params: { path: { versionId: SAMPLE.versionId, moduleId: firstModule.moduleId } },
        body: { isLocked: true },
      }),
    );
  });

  it('shows a locked module, and its sections and lessons as inherited', async () => {
    withGet({ [VERSION]: versionWithFirstModuleLocked() });
    renderApp(studio);
    expect(await screen.findByText('Locked')).toBeInTheDocument();
    await setupUser().click(screen.getByRole('button', { name: 'Expand all' }));
    await waitFor(() => expect(screen.getAllByText('Locked (inherited)').length).toBeGreaterThan(1));
  });

  it('lets one lesson stay open inside a locked module, and clears it again', async () => {
    withGet({
      [VERSION]: versionWithFirstModuleLocked(),
      [ITEMS]: [{ ...firstItem, isLocked: false }, secondItem],
    });
    const user = setupUser();
    renderApp(studio);
    await user.click(await screen.findByRole('button', { name: 'Expand all' }));
    const firstRow = (await screen.findAllByRole('button', { name: firstItem.name }))[0].closest('li')!;
    expect(within(firstRow).getByText('Open')).toBeInTheDocument();
    const secondRow = screen.getAllByRole('button', { name: secondItem.name })[0].closest('li')!;
    expect(within(secondRow).getByText('Locked (inherited)')).toBeInTheDocument();

    await openLockMenu(user, `Lesson ${firstItem.name}`);
    expect(await screen.findByRole('menuitemradio', { name: /Open: students can reach it/ })).toHaveAttribute('aria-checked', 'true');
    await choose('Inherit (locked)', user);
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(ITEM_LOCK, {
        params: { path: { versionId: SAMPLE.versionId, itemId: firstItem._id } },
        body: { isLocked: null },
      }),
    );
  });

  it('explains a failed save and keeps the saved value', async () => {
    api.PUT.mockImplementation(async () => ({
      data: undefined,
      error: { message: 'Server unavailable' },
      response: new Response(null, { status: 500 }),
    }));
    const user = setupUser();
    renderApp(studio);
    await openLockMenu(user, `Module ${firstModule.name}`);
    await choose(/Locked: closed to students/, user);
    expect(await screen.findByText(/The lock wasn’t saved: Server unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  });
});
