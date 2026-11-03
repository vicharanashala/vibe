import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { readTrack } from './tracks';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
const base = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}`;
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';
const PROGRESS_WRITES = /\/(start|stop)$|watchtime\/upsert/;

function withGet(overrides: Record<string, unknown>) {
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => (p in overrides ? ok(overrides[p]) : fallback(p, ...rest)));
}

const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';

/** The query string each lesson read was sent with. */
function lessonQueries() {
  return api.GET.mock.calls
    .filter(([p]) => p === ITEM)
    .map(([, opts]) => (opts as { params?: { query?: Record<string, string> } })?.params?.query ?? {});
}

beforeEach(() => {
  resetSession();
  signInStudent();
  withGet({ [CONSENT]: { signed: true } });
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => Promise.reject(new Error('camera should not be used'))) },
  });
});

describe('study mode (blue)', () => {
  it('opens a lesson with a study-mode read, no camera, and never saves progress', async () => {
    renderApp(`${base}/${path.item.id}?track=blue`);
    expect(await screen.findByRole('heading', { name: fixtures.itemBlog.item.name })).toBeInTheDocument();
    expect(screen.getByText('Study mode')).toBeInTheDocument();
    expect(lessonQueries()).toContainEqual({ mode: 'study' });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Your camera')).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.POST.mock.calls.filter(([p]) => PROGRESS_WRITES.test(p))).toEqual([]);
  });

  it('moves freely with Previous/Next through the syllabus', async () => {
    renderApp(`${base}/${path.item.id}?track=blue`);
    const next = await screen.findByRole('link', { name: /next/i });
    const second = fixtures.sectionItems[1];
    await waitFor(() => expect(next.getAttribute('href')).toContain(`/${second._id}?track=blue`));
  });

  it('remembers the chosen track for the course', async () => {
    renderApp(`${base}/${path.item.id}?track=blue`);
    await screen.findByRole('heading', { name: fixtures.itemBlog.item.name });
    expect(readTrack(enrollment.courseVersionId)).toBe('blue');
  });
});

describe('strict mode (green)', () => {
  it('keeps lessons in order even when the backend would serve them', async () => {
    withGet({
      [CONSENT]: { signed: true },
      '/api/users/progress/courses/{courseId}/versions/{versionId}/current-path': { ...path, item: { ...path.item, id: 'some-earlier-item' } },
    });
    renderApp(`${base}/${path.item.id}?track=green`);
    expect(await screen.findByRole('heading', { name: 'Finish the earlier lessons first' })).toBeInTheDocument();
    expect(api.POST.mock.calls.filter(([p]) => PROGRESS_WRITES.test(p))).toEqual([]);
  });

  it('defaults to green, reads the lesson normally and saves progress', async () => {
    renderApp(`${base}/${path.item.id}`);
    expect(await screen.findByText('Strict mode')).toBeInTheDocument();
    expect(lessonQueries()).toContainEqual({});
    await waitFor(() => expect(api.POST.mock.calls.some(([p]) => /\/start$/.test(p))).toBe(true));
  });
});

describe('course page', () => {
  it('lets the student pick a mode, and study mode opens lessons in any order', async () => {
    const user = userEvent.setup();
    renderApp(`/courses/${enrollment.courseId}/${enrollment.courseVersionId}`);
    const switcher = await screen.findByRole('tablist', { name: 'Mode' });
    expect(within(switcher).getByRole('tab', { name: 'Strict mode' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(switcher).getByRole('tab', { name: 'Study mode' }));
    expect(screen.getByText(/Nothing counts towards your progress/)).toBeInTheDocument();
    const current = await screen.findByRole('link', { name: new RegExp(path.item.name) });
    expect(current.getAttribute('href')).toContain('track=blue');
    // The course is linear, but study mode doesn't lock unreached lessons.
    const second = fixtures.sectionItems[1];
    const later = await screen.findByRole('link', { name: new RegExp(second.name) });
    expect(later.getAttribute('href')).toContain('track=blue');
    expect(screen.queryByText(/Unlocks in/)).not.toBeInTheDocument();
  });
});
