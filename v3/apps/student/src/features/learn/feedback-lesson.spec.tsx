import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import {
  api,
  ok,
  resetSession,
  respond,
  respondPost,
  signInStudent,
} from '@/test/session';
import { FEEDBACK, studio, studioGet } from '@/test/studio';

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const url = (track: 'green' | 'blue') =>
  `/learn/${FEEDBACK.courseId}/${FEEDBACK.versionId}/${FEEDBACK.moduleId}/${FEEDBACK.sectionId}/${FEEDBACK.itemId}?track=${track}`;
const SUBMIT = '/api/quizzes/{itemId}/feedback/submit';
const STOP = '/api/users/progress/courses/{courseId}/versions/{versionId}/stop';
const RATING = 'How useful was the previous lesson?';
const CHOICE = 'Which part was hardest?';

/** The student is on the feedback form (the backend's current path points at it). */
function onFeedbackForm() {
  const version = studio.feedbackVersion;
  api.GET.mockImplementation(
    async (
      path: string,
      opts?: { params?: { path?: Record<string, string> } },
    ) => {
      if (path === '/api/users/me') return respond(path);
      // Consent signed, like the existing lesson specs, so the form itself shows.
      if (
        path ===
        '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent'
      )
        return ok({ signed: true });
      if (
        path ===
        '/api/users/progress/courses/{courseId}/versions/{versionId}/current-path'
      ) {
        return ok({
          module: { id: FEEDBACK.moduleId, name: version.modules[0].name },
          section: {
            id: FEEDBACK.sectionId,
            name: version.modules[0].sections[0].name,
          },
          item: {
            id: FEEDBACK.itemId,
            name: studio.feedbackItem.item.name,
            type: 'FEEDBACK',
          },
        });
      }
      return studioGet(path, opts);
    },
  );
}

beforeEach(() => {
  resetSession();
  signInStudent();
  onFeedbackForm();
});

describe('feedback lesson (certified mode)', () => {
  it('asks for required answers before sending anything', async () => {
    const user = userEvent.setup();
    renderApp(url('green'));
    await user.click(
      await screen.findByRole('button', { name: 'Send feedback' }),
    );
    expect(
      await screen.findByText('This question is required.'),
    ).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalledWith(SUBMIT, expect.anything());
    // Required questions mean the form can't be skipped.
    expect(
      screen.queryByRole('button', { name: 'Skip' }),
    ).not.toBeInTheDocument();
  });

  it('sends the answers, then completes the lesson', async () => {
    const user = userEvent.setup();
    renderApp(url('green'));
    expect(await screen.findByText('0 of 3 answered')).toBeInTheDocument();
    await user.click(await screen.findByText('4', { exact: true }));
    await user.click(screen.getByText('Collisions', { exact: true }));
    expect(screen.getByText('2 of 3 answered')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(STOP, expect.anything()),
    );
    const calls = api.POST.mock.calls.map((c) => c[0]);
    expect(calls.indexOf(SUBMIT)).toBeLessThan(calls.indexOf(STOP));
    const submit = api.POST.mock.calls.find((c) => c[0] === SUBMIT)![1];
    expect(submit).toEqual({
      params: { path: { itemId: FEEDBACK.itemId } },
      // The unanswered optional question is left out rather than sent empty.
      body: {
        details: { [RATING]: '4', [CHOICE]: 'Collisions' },
        courseId: FEEDBACK.courseId,
        courseVersionId: FEEDBACK.versionId,
        sectionId: FEEDBACK.sectionId,
      },
    });
    expect(
      api.POST.mock.calls.find((c) => c[0] === STOP)![1].body,
    ).toMatchObject({ watchItemId: 'watch-1', itemId: FEEDBACK.itemId });
  });

  it('retries a failed progress save without sending the answers twice', async () => {
    const user = userEvent.setup();
    let stops = 0;
    api.POST.mockImplementation(async (path: string) => {
      if (path === STOP && ++stops === 1)
        return {
          data: undefined,
          error: { message: 'Write conflict' },
          response: new Response(null, { status: 500 }),
        };
      return respondPost(path);
    });
    renderApp(url('green'));
    await user.click(await screen.findByText('5', { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));
    await waitFor(() => expect(stops).toBe(2));
    expect(api.POST.mock.calls.filter((c) => c[0] === SUBMIT)).toHaveLength(1);
  });
});

describe('feedback lesson (study mode)', () => {
  it('shows the form read-only and never sends it', async () => {
    renderApp(url('blue'));
    expect(
      await screen.findByText(/Answers are sent only in certified mode/),
    ).toBeInTheDocument();
    // Study mode keeps the lesson hidden until the camera is on, hence `hidden: true`;
    // only the visible radio controls (not Base UI's hidden native inputs) are checked.
    const radios = screen
      .getAllByRole('radio', { hidden: true })
      .filter((r) => r.dataset.slot === 'radio-group-item');
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios)
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.queryByRole('button', { name: 'Send feedback' }),
    ).not.toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalledWith(SUBMIT, expect.anything());
  });
});
