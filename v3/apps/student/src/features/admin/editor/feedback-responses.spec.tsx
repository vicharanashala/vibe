import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { FEEDBACK, signInAdmin, studio, studioGet } from '@/test/studio';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const loc = FEEDBACK;
const editorUrl = `/admin/courses/${loc.courseId}/${loc.versionId}/lesson?module=${loc.moduleId}&section=${loc.sectionId}&item=${loc.itemId}`;
const SUBMISSIONS = '/api/courses/{courseId}/item/{feedbackId}/feedback/submissions';
const SUMMARY = '/api/courses/{courseId}/item/{feedbackId}/feedback/summary';
const FORM_EXPORT = '/api/courses/{courseId}/item/{feedbackId}/feedback/export';
const COURSE_EXPORT = '/api/courses/{courseId}/versions/{versionId}/feedback/export';
const COHORT = { id: '6af000000000000000000001', name: 'Batch A' };

type Opts = { params?: { path?: Record<string, string>; query?: Record<string, string> }; parseAs?: string };
const queryOf = (path: string) => api.GET.mock.calls.filter((c) => c[0] === path).map((c) => (c[1] as Opts)?.params?.query ?? {});

/** Studio fixtures, plus a cohort on the version and downloadable files. */
function withExtras(overrides: (path: string, opts?: Opts) => unknown = () => undefined) {
  api.GET.mockImplementation(async (path: string, opts?: Opts) => {
    const custom = overrides(path, opts);
    if (custom) return custom;
    if (path === '/api/courses/versions/{versionId}')
      return ok({ ...studio.feedbackVersion, cohortDetails: [COHORT] });
    if (path === FORM_EXPORT || path === COURSE_EXPORT)
      return {
        data: new Blob(['file']),
        error: undefined,
        response: new Response(null, {
          headers: { 'content-disposition': `attachment; filename="x.xlsx"; filename*=UTF-8''Course%20feedback.xlsx` },
        }),
      };
    return studioGet(path, opts);
  });
}

beforeEach(() => {
  resetSession();
  signInAdmin();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  withExtras();
});

async function openResponses(user: ReturnType<typeof userEvent.setup>) {
  renderApp(editorUrl);
  await user.click(await screen.findByRole('tab', { name: 'Responses' }));
}

describe('feedback responses in Studio', () => {
  it('searches by name or email on the server', async () => {
    const user = userEvent.setup();
    await openResponses(user);
    await user.click(await screen.findByRole('tab', { name: /Individual/ }));
    await user.type(screen.getByRole('textbox', { name: 'Search by name or email' }), 'student@');
    await waitFor(() => expect(queryOf(SUBMISSIONS).some((q) => q.search === 'student@')).toBe(true));
  });

  it('opens one student’s full answers with their earlier versions', async () => {
    const [current] = studio.feedbackSubmissions.submissions;
    withExtras((path, opts) =>
      path === SUBMISSIONS && opts?.params?.query?.history === 'all'
        ? ok({
            submissions: [
              { ...current, isCurrentVersion: true },
              { ...current, _id: 'old1', createdAt: '2026-10-01T08:00:00.000Z', details: { 'How useful was the previous lesson?': '2' }, isCurrentVersion: false },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup();
    await openResponses(user);
    await user.click(await screen.findByRole('tab', { name: /Individual/ }));
    const open = await screen.findAllByRole('button', { name: /Open .*answers/ });
    // The first response is the one with a written answer.
    await user.click(open[0]);
    const answers = within(await screen.findByLabelText('Answers'));
    expect(answers.getByText('More diagrams please.')).toBeInTheDocument();
    expect(await screen.findByText(/Replaced answer from/)).toBeInTheDocument();
    expect(queryOf(SUBMISSIONS).some((q) => q.history === 'all' && q.userId)).toBe(true);
  });

  it('filters by cohort for cohort courses', async () => {
    const user = userEvent.setup();
    await openResponses(user);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Cohort' }), COHORT.id);
    await waitFor(() => expect(queryOf(SUMMARY).some((q) => q.cohortId === COHORT.id)).toBe(true));
  });

  it('summarises every current answer, with no cap', async () => {
    withExtras((path) =>
      path === SUMMARY
        ? ok({
            total: 4000,
            questions: [
              { key: 'Which part was hardest?', title: 'Which part was hardest?', kind: 'choice', answered: 4000, counts: { Hashing: 3000, Collisions: 1000 } },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup();
    await openResponses(user);
    expect(await screen.findByText('4000 of 4000 answered')).toBeInTheDocument();
    expect(screen.getByText('3000 · 75%')).toBeInTheDocument();
  });

  it('downloads one form as Excel or CSV, optionally with earlier versions', async () => {
    const user = userEvent.setup();
    await openResponses(user);
    await user.click(await screen.findByRole('button', { name: /Download/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Include earlier versions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Excel/ }));
    await waitFor(() => expect(queryOf(FORM_EXPORT)).toEqual([{ format: 'xlsx', history: 'all' }]));
    expect(await screen.findByText('Downloaded Course feedback.xlsx')).toBeInTheDocument();
  });

  it('offers to try again when a download fails', async () => {
    withExtras((path) =>
      path === FORM_EXPORT ? { data: undefined, error: { message: 'boom' }, response: new Response(null, { status: 500 }) } : undefined,
    );
    const user = userEvent.setup();
    await openResponses(user);
    await user.click(await screen.findByRole('button', { name: /Download/ }));
    await user.click(await screen.findByRole('menuitem', { name: /CSV/ }));
    expect(await screen.findByText('Couldn’t prepare the file. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('course Feedback tab', () => {
  const courseUrl = `/admin/courses/${loc.courseId}/${loc.versionId}?tab=feedback`;

  it('lists every form with its responses and a link to them', async () => {
    renderApp(courseUrl);
    const table = await screen.findByRole('table', { name: 'Feedback forms' });
    const row = within(table).getByRole('row', { name: /Feedback Week 1 Read then reflect Short reading 2/ });
    expect(within(row).getByRole('link', { name: 'Feedback: responses' })).toHaveAttribute(
      'href',
      expect.stringContaining(`item=${loc.itemId}`),
    );
  });

  it('downloads the course workbook, every answer, or watch time + feedback', async () => {
    const user = userEvent.setup();
    renderApp(courseUrl);
    await screen.findByRole('table', { name: 'Feedback forms' });
    await user.click(screen.getByRole('button', { name: /Download feedback/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Excel workbook/ }));
    await waitFor(() => expect(queryOf(COURSE_EXPORT)).toEqual([{ format: 'xlsx' }]));
    await user.click(screen.getByRole('button', { name: /Download feedback/ }));
    await user.click(await screen.findByRole('menuitem', { name: /watch time \+ feedback/ }));
    await waitFor(() => expect(queryOf(COURSE_EXPORT).at(-1)).toEqual({ format: 'csv', type: 'watch' }));
  });

  it('shows study-mode feedback as on by default, and turns it off', async () => {
    const SETTINGS = '/api/courses/{courseId}/versions/{versionId}/feedback/settings';
    let saved = true;
    withExtras((path) => (path === SETTINGS ? ok({ studyModeFeedback: saved }) : undefined));
    api.PUT.mockImplementation(async (path: string, opts?: { body?: { studyModeFeedback: boolean } }) => {
      if (path === SETTINGS) {
        saved = opts!.body!.studyModeFeedback;
        return ok({ studyModeFeedback: saved });
      }
      return ok({});
    });
    const user = userEvent.setup();
    renderApp(courseUrl);
    const toggle = await screen.findByRole('switch', { name: /Students can send feedback in study mode/ });
    await waitFor(() => expect(toggle).toBeChecked());
    expect(screen.getByText(/Phones can only use study mode/)).toBeInTheDocument();
    await user.click(toggle);
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(SETTINGS, {
        params: { path: { courseId: loc.courseId, versionId: loc.versionId } },
        body: { studyModeFeedback: false },
      }),
    );
    await waitFor(() => expect(toggle).not.toBeChecked());
  });
});
