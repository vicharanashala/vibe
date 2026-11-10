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

const MINE = '/api/quizzes/{itemId}/feedback/mine';

/** The student is on the feedback form (the backend's current path points at it). */
function onFeedbackForm(mine: unknown = null) {
  const version = studio.feedbackVersion;
  api.GET.mockImplementation(
    async (
      path: string,
      opts?: { params?: { path?: Record<string, string> } },
    ) => {
      if (path === '/api/users/me') return respond(path);
      if (path === MINE) return ok({ feedback: mine });
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

const answeredBefore = {
  details: { [RATING]: '4', [CHOICE]: 'Collisions' },
  createdAt: '2026-11-01T10:00:00.000Z',
};

describe('feedback lesson: answering again', () => {
  it('fills in the student’s earlier answers and moves on without resending them', async () => {
    onFeedbackForm(answeredBefore);
    const user = userEvent.setup();
    renderApp(url('green'));
    expect(await screen.findByText(/You answered this on/)).toBeInTheDocument();
    expect(await screen.findByText('2 of 3 answered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update feedback' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(api.POST).toHaveBeenCalledWith(STOP, expect.anything()));
    expect(api.POST).not.toHaveBeenCalledWith(SUBMIT, expect.anything());
  });

  it('sends an updated answer once something changes', async () => {
    onFeedbackForm(answeredBefore);
    const user = userEvent.setup();
    renderApp(url('green'));
    await screen.findByText(/You answered this on/);
    await user.click(await screen.findByText('5', { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Update feedback' }));
    await waitFor(() => expect(api.POST).toHaveBeenCalledWith(SUBMIT, expect.anything()));
    expect(api.POST.mock.calls.find((c) => c[0] === SUBMIT)![1].body.details).toEqual({
      [RATING]: '5',
      [CHOICE]: 'Collisions',
    });
  });

  it('explains a refusal in plain words, keeps the answers and links to the previous lesson', async () => {
    api.POST.mockImplementation(async (path: string) =>
      path === SUBMIT
        ? {
            data: undefined,
            error: { message: 'Watch the previous video before sending this feedback.' },
            response: new Response(null, { status: 403 }),
          }
        : respondPost(path),
    );
    const user = userEvent.setup();
    renderApp(url('green'));
    await user.click(await screen.findByText('4', { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(
      await screen.findByText(/Watch the previous video before sending this feedback\. Your answers are kept\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the previous lesson' })).toBeInTheDocument();
    expect(screen.getByText('1 of 3 answered')).toBeInTheDocument();
    expect(api.POST).not.toHaveBeenCalledWith(STOP, expect.anything());
  });
});

describe('feedback lesson (study mode)', () => {
  it('shows the student’s earlier answers in the read-only preview', async () => {
    onFeedbackForm(answeredBefore);
    renderApp(url('blue'));
    expect(await screen.findByText(/Showing what you answered on/)).toBeInTheDocument();
    const checked = screen
      .getAllByRole('radio', { hidden: true })
      .filter((r) => r.dataset.slot === 'radio-group-item' && r.getAttribute('aria-checked') === 'true');
    expect(checked.length).toBeGreaterThan(0);
  });

  it('shows the form read-only and never sends it', async () => {
    renderApp(url('blue'));
    expect(
      await screen.findByText(/Answers are sent only in strict mode/),
    ).toBeInTheDocument();
    // Only the visible radio controls (not Base UI's hidden native inputs) are checked.
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
