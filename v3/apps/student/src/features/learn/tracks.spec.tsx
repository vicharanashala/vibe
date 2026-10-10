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

/** A fake camera whose track can be "unplugged" from the test. */
function fakeCamera() {
  const listeners: Record<string, () => void> = {};
  const track = {
    readyState: 'live' as MediaStreamTrackState,
    muted: false,
    stop: vi.fn(),
    addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
  };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
  return {
    unplug() {
      track.readyState = 'ended';
      listeners.ended?.();
    },
  };
}

beforeEach(() => {
  resetSession();
  signInStudent();
  withGet({ [CONSENT]: { signed: true } });
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
});

describe('study mode (blue)', () => {
  it('opens a lesson with the camera on and never saves progress', async () => {
    fakeCamera();
    renderApp(`${base}/${path.item.id}?track=blue`);
    expect(await screen.findByRole('heading', { name: fixtures.itemBlog.item.name })).toBeInTheDocument();
    expect(screen.getByText('Study mode')).toBeInTheDocument();
    expect(await screen.findByLabelText('Your camera')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /turn your camera on/i })).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.POST.mock.calls.filter(([p]) => PROGRESS_WRITES.test(p))).toEqual([]);
  });

  it('blocks the lesson when the camera turns off', async () => {
    const camera = fakeCamera();
    renderApp(`${base}/${path.item.id}?track=blue`);
    await screen.findByLabelText('Your camera');
    camera.unplug();
    expect(await screen.findByRole('heading', { name: 'Turn your camera on to continue' })).toBeInTheDocument();
  });

  it('asks for camera access when it is blocked', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => Promise.reject(new DOMException('no', 'NotAllowedError'))) },
    });
    renderApp(`${base}/${path.item.id}?track=blue`);
    expect(await screen.findByText(/Camera access is blocked/)).toBeInTheDocument();
  });

  it('moves freely with Previous/Next through the syllabus', async () => {
    fakeCamera();
    renderApp(`${base}/${path.item.id}?track=blue`);
    const next = await screen.findByRole('link', { name: /next/i });
    const second = fixtures.sectionItems[1];
    await waitFor(() => expect(next.getAttribute('href')).toContain(`/${second._id}?track=blue`));
  });

  it('remembers the chosen track for the course', async () => {
    fakeCamera();
    renderApp(`${base}/${path.item.id}?track=blue`);
    await screen.findByLabelText('Your camera');
    expect(readTrack(enrollment.courseVersionId)).toBe('blue');
  });
});

describe('certified mode (green)', () => {
  it('keeps lessons in order even when the backend would serve them', async () => {
    withGet({
      [CONSENT]: { signed: true },
      '/api/users/progress/courses/{courseId}/versions/{versionId}/current-path': { ...path, item: { ...path.item, id: 'some-earlier-item' } },
    });
    renderApp(`${base}/${path.item.id}?track=green`);
    expect(await screen.findByRole('heading', { name: 'Finish the earlier lessons first' })).toBeInTheDocument();
    expect(api.POST.mock.calls.filter(([p]) => PROGRESS_WRITES.test(p))).toEqual([]);
  });

  it('defaults to green and saves progress', async () => {
    renderApp(`${base}/${path.item.id}`);
    expect(await screen.findByText('Certified mode')).toBeInTheDocument();
    await waitFor(() => expect(api.POST.mock.calls.some(([p]) => /\/start$/.test(p))).toBe(true));
  });
});

describe('course page', () => {
  it('lets the student pick a track and locks unreached lessons on blue in linear courses', async () => {
    const user = userEvent.setup();
    renderApp(`/courses/${enrollment.courseId}/${enrollment.courseVersionId}`);
    const switcher = await screen.findByRole('group', { name: 'Mode' });
    expect(within(switcher).getByRole('button', { name: 'Certified mode' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(switcher).getByRole('button', { name: 'Study mode' }));
    expect(screen.getByText(/Nothing is saved to your progress/)).toBeInTheDocument();
    const current = await screen.findByRole('link', { name: new RegExp(path.item.name) });
    expect(current.getAttribute('href')).toContain('track=blue');
    expect(screen.getAllByText('Unlocks in certified mode').length).toBeGreaterThan(0);
  });
});
