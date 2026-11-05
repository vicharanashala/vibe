import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { isProctored, toSeconds, youtubeId } from './queries';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
const lessonUrl = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}/${path.item.id}`;
const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';
const START = '/api/users/progress/courses/{courseId}/versions/{versionId}/start';
const STOP = '/api/users/progress/courses/{courseId}/versions/{versionId}/stop';

/** Overrides specific GET routes on top of the default fixtures. */
function withGet(overrides: Record<string, unknown>) {
  const base = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => (p in overrides ? ok(overrides[p]) : base(p, ...rest)));
}

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('lesson player', () => {
  it('asks for the consent form before the first lesson and posts the signature', async () => {
    const user = userEvent.setup();
    renderApp(lessonUrl);
    const declaration = await screen.findByRole('checkbox', { name: /I have read and understood/ });
    const submit = screen.getByRole('button', { name: 'Sign and continue' });
    expect(submit).toBeDisabled();
    await user.click(declaration);
    await user.click(submit);
    expect(api.POST).toHaveBeenCalledWith(CONSENT, {
      params: { path: { courseId: enrollment.courseId, versionId: enrollment.courseVersionId } },
      body: { signature: 'Asha Student', additionalImageConsent: false },
    });
  });

  it('starts a reading, then on Continue stops it and opens the next lesson the backend points to', async () => {
    // Like the backend: this lesson is current until it is stopped, then the next one is.
    let stopped = false;
    const post = api.POST.getMockImplementation()!;
    api.POST.mockImplementation(async (p: string, ...rest: unknown[]) => {
      if (p === STOP) stopped = true;
      return post(p, ...rest);
    });
    const get = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => {
      if (p === CONSENT) return ok({ signed: true });
      if (p === '/api/users/progress/courses/{courseId}/versions/{versionId}/current-path') {
        return ok(stopped ? { ...path, item: { id: 'next-item', name: 'Arrays in practice', type: 'VIDEO' } } : path);
      }
      return get(p, ...rest);
    });
    const user = userEvent.setup();
    const { router } = renderApp(lessonUrl);

    expect(await screen.findByRole('heading', { name: fixtures.itemBlog.item.name })).toBeInTheDocument();
    expect(screen.getByText(fixtures.itemBlog.item.details.content)).toBeInTheDocument();
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(START, {
        params: { path: { courseId: enrollment.courseId, versionId: enrollment.courseVersionId } },
        body: { itemId: path.item.id, moduleId: path.module.id, sectionId: path.section.id },
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(api.POST).toHaveBeenCalledWith(STOP, {
      params: { path: { courseId: enrollment.courseId, versionId: enrollment.courseVersionId } },
      body: { watchItemId: 'watch-1', itemId: path.item.id, moduleId: path.module.id, sectionId: path.section.id },
    });
    await waitFor(() => expect(router.state.location.pathname.endsWith('/next-item')).toBe(true));
  });

  it('keeps Continue disabled on a video until it has been watched', async () => {
    withGet({ [CONSENT]: { signed: true }, [ITEM]: fixtures.itemVideo });
    renderApp(lessonUrl);
    expect(await screen.findByText('Watch to the end to continue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('shows a locked screen when a linear course is opened out of order', async () => {
    withGet({ [CONSENT]: { signed: true } });
    api.POST.mockImplementation(async (p: string) =>
      p === START
        ? { data: undefined, error: { message: 'ModuleId, sectionId and itemId do not match current progress' }, response: new Response(null, { status: 400 }) }
        : ok({}),
    );
    renderApp(lessonUrl);
    expect(await screen.findByRole('heading', { name: 'Finish the earlier lessons first' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /go to your next lesson/i })).toBeInTheDocument();
  });

  it('never opens a proctored lesson without proctoring', async () => {
    const proctored = structuredClone(fixtures.itemBlog);
    proctored.item.proctoringDetectors[5].settings.enabled = true; // virtualBackgroundDetection — no implementation exists to port yet
    withGet({ [CONSENT]: { signed: true }, [ITEM]: proctored });
    renderApp(lessonUrl);
    expect(await screen.findByRole('heading', { name: 'This lesson is proctored' })).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalledWith(START, expect.anything());
  });
});

describe('lesson helpers', () => {
  it('parses the backend time format', () => {
    expect(toSeconds('00:05:00')).toBe(300);
    expect(toSeconds('01:02:03')).toBe(3723);
    expect(toSeconds('2:30')).toBe(150);
    expect(toSeconds(undefined)).toBe(0);
  });

  it('extracts YouTube ids from the URL shapes courses use', () => {
    for (const url of ['https://www.youtube.com/watch?v=QJNwK2uJyGs', 'https://youtu.be/QJNwK2uJyGs', 'https://www.youtube.com/embed/QJNwK2uJyGs']) {
      expect(youtubeId(url)).toBe('QJNwK2uJyGs');
    }
    expect(youtubeId('https://example.com/video.mp4')).toBeNull();
  });

  it('treats a lesson as proctored when any detector is enabled', () => {
    expect(isProctored(fixtures.itemBlog.item.proctoringDetectors)).toBe(false);
    expect(isProctored([{ detectorName: 'blurDetection', settings: { enabled: true } }])).toBe(true);
  });
});
