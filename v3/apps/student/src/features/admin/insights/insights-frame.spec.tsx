import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { courseInsightsFixture } from '@/test/fixtures/studio/course-insights';
import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { SAMPLE, signInAdmin, studioGet } from '@/test/studio';

import { OVERVIEW_PATH } from './queries';
import type { CourseInsights } from './types';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

type Opts = { params?: { path?: Record<string, string>; query?: Record<string, unknown> } };
const base = `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}`;
const insightsCalls = () =>
  api.GET.mock.calls.filter(([p]) => p === OVERVIEW_PATH).map(([, o]) => (o as Opts).params?.query);

function serve(insights: (range: number) => CourseInsights | Promise<never>) {
  api.GET.mockImplementation(async (path: string, opts?: Opts) => {
    if (path === OVERVIEW_PATH) {
      const r = insights(Number(opts?.params?.query?.range ?? 30));
      return r instanceof Promise ? r : ok(r);
    }
    return studioGet(path, opts as never);
  });
}

beforeEach(() => {
  resetSession();
  signInAdmin();
  serve((range) => courseInsightsFixture(range as 7 | 30 | 90));
});

describe('range', () => {
  it('defaults to 30 days, and switching updates the URL and asks for that range', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(base);
    const group = await screen.findByRole('group', { name: 'Time range' });
    expect(within(group).getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(insightsCalls()).toContainEqual({ range: 30 }));

    await user.click(within(group).getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ range: 7 }));
    await waitFor(() => expect(insightsCalls()).toContainEqual({ range: 7 }));
    expect(within(group).getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the range from the URL on reload', async () => {
    renderApp(`${base}?range=90`);
    const group = await screen.findByRole('group', { name: 'Time range' });
    expect(within(group).getByRole('button', { name: 'Last 90 days' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(insightsCalls()).toContainEqual({ range: 90 }));
    expect(insightsCalls()).not.toContainEqual({ range: 30 });
  });
});

describe('states', () => {
  it('shows placeholders while the insights load', async () => {
    serve(() => new Promise<never>(() => {}));
    renderApp(base);
    expect(await screen.findByLabelText('Insights loading')).toBeInTheDocument();
  });

  it('says when the figures were last updated', async () => {
    renderApp(base);
    expect((await screen.findAllByText('Updated 6 minutes ago')).length).toBeGreaterThan(0);
  });

  it('says insights are being prepared during the first build, and keeps the course actions', async () => {
    serve((range) => ({ status: 'building', updatedAt: null, range: range as 30 }));
    renderApp(base);
    expect(await screen.findByText('Insights are being prepared')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Content/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Invite people/ })).toBeInTheDocument();
  });

  it('invites the teacher to add students when the course has none, with no empty charts', async () => {
    serve((range) => {
      const f = courseInsightsFixture(range as 30);
      return { ...f, headline: { ...f.headline!, students: { current: 0, previous: null } } };
    });
    renderApp(base);
    expect(await screen.findByText('No students yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite students' })).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('keeps the existing overview: finished students, action tiles, registration link and description', async () => {
    renderApp(base);
    expect(await screen.findByText('Finished the course')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Proctoring/ })).toBeInTheDocument();
    expect(await screen.findByText('Registration link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it('gives every chart and list a title and a one-sentence summary', async () => {
    renderApp(base);
    await screen.findByRole('figure', { name: 'Daily activity' });
    const figures = screen.getAllByRole('figure');
    expect(figures.map((el) => el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Daily activity',
      'New enrolments',
      'When students study',
      'Progress',
      'Module by module',
      'Where students are now',
      'Students to check on',
      'Quizzes',
      'Videos',
      'Proctoring',
      'Study mode and strict mode',
    ]);
    for (const fig of figures) expect(fig).toHaveAccessibleDescription(/\w.+\./);
  });
});
