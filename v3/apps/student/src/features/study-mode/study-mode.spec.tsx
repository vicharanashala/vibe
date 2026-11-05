import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@vibe/api';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { resolveStudyMode, studyModeRefusal } from './study-mode';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
const base = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}`;
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';
const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';
const VERSION = '/api/courses/versions/{versionId}';
const PROGRESS_WRITES = /\/(start|stop)$|watchtime\/upsert/;

type Reply = { data?: unknown; error?: unknown; response: Response };
const forbidden = (body: unknown): Reply => ({ data: undefined, error: body, response: new Response(null, { status: 403 }) });

/** Overrides GET routes; a function value decides per request (e.g. by `?mode=`). */
function withGet(overrides: Record<string, unknown | ((opts: { params?: { query?: { mode?: string } } }) => Reply)>) {
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => {
    if (!(p in overrides)) return fallback(p, ...rest);
    const v = overrides[p];
    return typeof v === 'function' ? (v as (o: unknown) => Reply)(rest[0]) : ok(v);
  });
}

const disabledBy = (source: 'module' | 'section' | 'item') =>
  forbidden({
    name: 'STUDY_MODE_DISABLED',
    message: `The instructor has disabled study mode for this ${source}.`,
    details: { source },
  });

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

const progressWrites = () => api.POST.mock.calls.filter(([p]) => PROGRESS_WRITES.test(p));

beforeEach(() => {
  resetSession();
  signInStudent();
  setPrimaryTouch(false);
  withGet({ [CONSENT]: { signed: true } });
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
});

describe('resolveStudyMode', () => {
  it('follows item > section > module, allowing study mode when nothing is set', () => {
    expect(resolveStudyMode({}, {}, {})).toEqual({ allowed: true, source: 'default' });
    expect(resolveStudyMode({ studyModeEnabled: null }, {}, { studyModeEnabled: false })).toEqual({ allowed: false, source: 'module' });
    expect(resolveStudyMode({}, { studyModeEnabled: false }, { studyModeEnabled: true })).toEqual({ allowed: false, source: 'section' });
    expect(resolveStudyMode({ studyModeEnabled: true }, { studyModeEnabled: false }, {})).toEqual({ allowed: true, source: 'item' });
  });
});

describe('studyModeRefusal', () => {
  it('recognises the backend’s study-mode 403s and nothing else', () => {
    expect(studyModeRefusal(new ApiError(403, 'x', { name: 'STUDY_MODE_DISABLED', details: { source: 'section' } }))).toEqual({
      kind: 'disabled',
      source: 'section',
    });
    expect(studyModeRefusal(new ApiError(403, 'x', { name: 'STUDY_MODE_QUIZ' }))).toEqual({ kind: 'quiz' });
    expect(studyModeRefusal(new ApiError(403, "You don't have permission", { name: 'ForbiddenError' }))).toBeUndefined();
    expect(studyModeRefusal(new Error('network'))).toBeUndefined();
  });
});

describe('instructor-disabled study mode', () => {
  it.each([
    ['module', 'this module'],
    ['section', 'this section'],
    ['item', 'this lesson'],
  ] as const)('names the %s that disabled it and offers strict mode', async (source, level) => {
    withGet({ [CONSENT]: { signed: true }, [ITEM]: () => disabledBy(source) });
    renderApp(`${base}/${path.item.id}?track=blue`);
    expect(await screen.findByRole('heading', { name: 'Study mode is off here' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`The instructor has disabled study mode for ${level}`))).toBeInTheDocument();
    const switches = screen.getAllByRole('link', { name: 'Switch to strict mode' });
    for (const link of switches) expect(link.getAttribute('href')).toContain('track=green');
    expect(progressWrites()).toEqual([]);
  });

  it('shows the strict-mode quiz notice when the backend refuses a quiz', async () => {
    withGet({
      [CONSENT]: { signed: true },
      [ITEM]: () => forbidden({ name: 'STUDY_MODE_QUIZ', message: 'Quizzes can only be taken in strict mode on a computer.' }),
    });
    renderApp(`${base}/${path.item.id}?track=blue`);
    expect(await screen.findByRole('heading', { name: 'Quizzes are taken in strict mode' })).toBeInTheDocument();
    expect(api.POST.mock.calls.some(([p]) => p === '/api/quizzes/{quizId}/attempt')).toBe(false);
  });

  it('marks strict-only content in the study-mode outline and links it to strict mode', async () => {
    const version = structuredClone(fixtures.courseVersion);
    version.modules[0].sections[0] = { ...version.modules[0].sections[0], studyModeEnabled: false } as never;
    withGet({ [CONSENT]: { signed: true }, [VERSION]: version });
    const user = userEvent.setup();
    renderApp(`/courses/${enrollment.courseId}/${enrollment.courseVersionId}`);
    const switcher = await screen.findByRole('tablist', { name: 'Mode' });
    await user.click(within(switcher).getByRole('tab', { name: 'Study mode' }));

    const first = fixtures.sectionItems[0];
    const row = await screen.findByRole('link', { name: new RegExp(first.name) });
    expect(within(row).getByText(/Strict mode only/)).toBeInTheDocument();
    expect(row.getAttribute('href')).toContain('track=green');
  });
});

describe('strict mode on a phone', () => {
  beforeEach(() => setPrimaryTouch(true));

  it('asks to continue on a computer, offers study mode where allowed, and records nothing', async () => {
    renderApp(`${base}/${path.item.id}?track=green`);
    expect(await screen.findByRole('heading', { name: 'Continue on a computer' })).toBeInTheDocument();
    const study = screen.getByRole('link', { name: 'Open in study mode' });
    expect(study.getAttribute('href')).toContain('track=blue');
    // Only a study-mode read: a strict read can move the progress pointer.
    const queries = api.GET.mock.calls.filter(([p]) => p === ITEM).map(([, o]) => (o as { params: { query?: object } }).params.query);
    expect(queries.every((q) => (q as { mode?: string })?.mode === 'study')).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(progressWrites()).toEqual([]);
  });

  it('does not offer study mode where the instructor disabled it', async () => {
    withGet({ [CONSENT]: { signed: true }, [ITEM]: () => disabledBy('module') });
    renderApp(`${base}/${path.item.id}?track=green`);
    expect(await screen.findByRole('heading', { name: 'Continue on a computer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open in study mode' })).not.toBeInTheDocument();
  });

  it('does not offer study mode for a quiz', async () => {
    withGet({ [CONSENT]: { signed: true }, [ITEM]: fixtures.itemQuiz });
    renderApp(`${base}/${path.item.id}?track=green`);
    expect(await screen.findByRole('heading', { name: 'Continue on a computer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open in study mode' })).not.toBeInTheDocument();
    expect(api.POST.mock.calls.some(([p]) => p === '/api/quizzes/{quizId}/attempt')).toBe(false);
  });

  it('still opens study mode on a phone', async () => {
    renderApp(`${base}/${path.item.id}?track=blue`);
    expect(await screen.findByRole('heading', { name: fixtures.itemBlog.item.name })).toBeInTheDocument();
  });
});

describe('strict mode on a mouse-first device', () => {
  it('opens normally, even with a touchscreen', async () => {
    setPrimaryTouch(false);
    renderApp(`${base}/${path.item.id}?track=green`);
    expect(await screen.findByText('Strict mode')).toBeInTheDocument();
    await waitFor(() => expect(api.POST.mock.calls.some(([p]) => /\/start$/.test(p))).toBe(true));
    expect(screen.queryByRole('heading', { name: 'Continue on a computer' })).not.toBeInTheDocument();
  });
});
