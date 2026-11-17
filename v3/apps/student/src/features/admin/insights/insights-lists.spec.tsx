import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/tooltip';
import { courseInsightsFixture } from '@/test/fixtures/studio/course-insights';
import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { SAMPLE, signInAdmin, studioGet } from '@/test/studio';

import { isBlocker } from './lessons';
import { OVERVIEW_PATH } from './queries';
import { QuizInsights, sortQuizzes } from './quizzes';
import { StudentsToCheckOn } from './students';
import type { CourseInsights } from './types';
import { VideoInsights } from './videos';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

type Opts = { params?: { path?: Record<string, string>; query?: Record<string, unknown> } };
const f = courseInsightsFixture(30);
const base = `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}`;
const ENROLLMENTS = '/api/users/enrollments/courses/{courseId}/versions/{versionId}';

function serve(insights: CourseInsights = f) {
  api.GET.mockImplementation(async (path: string, opts?: Opts) =>
    path === OVERVIEW_PATH ? ok(insights) : studioGet(path, opts as never),
  );
}

beforeEach(() => {
  resetSession();
  signInAdmin();
  serve();
});

describe('where students are now', () => {
  it('flags a lesson where many students have sat for days', async () => {
    renderApp(base);
    const panel = await screen.findByRole('figure', { name: 'Where students are now' });
    const row = within(panel).getByText('Tutorial 3: Calling an API from a notebook').closest('tr')!;
    expect(row).toHaveTextContent('15');
    expect(row).toHaveTextContent('4 days');
    expect(within(row).getByText('Possible blocker')).toBeInTheDocument();
    // 11 students for a median of 1.4 days isn't a blocker.
    expect(within(within(panel).getByText('Prompting checkpoint quiz').closest('tr')!).queryByText('Possible blocker')).toBeNull();
    expect(isBlocker({ students: 4, medianDaysThere: 10 })).toBe(false);
  });

  it('opens a listed lesson in the lesson editor', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(base);
    await user.click(await screen.findByRole('button', { name: 'Open Tutorial 3: Calling an API from a notebook' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/lesson`));
    expect(router.state.location.search).toMatchObject({ module: 'm3', section: 's3', item: 'v-tut3' });
  });
});

describe('quizzes', () => {
  it('lists the hardest quiz first', () => {
    render(<QuizInsights quizzes={f.quizzes!} />);
    expect(sortQuizzes(f.quizzes!).map((q) => q.name)).toEqual([
      'Tools and APIs quiz',
      'Prompting checkpoint quiz',
      'Module 1 check-in',
    ]);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Tools and APIs quiz');
    expect(rows[0]).toHaveTextContent('35%');
    expect(screen.getByRole('figure', { name: 'Quizzes' })).toHaveAccessibleDescription(
      'Hardest: “Tools and APIs quiz”, passed first time by 35% of students.',
    );
  });

  it('opens a quiz’s score distribution and hardest questions', async () => {
    const user = userEvent.setup();
    render(<QuizInsights quizzes={f.quizzes!} />);
    await user.click(screen.getByRole('button', { name: 'Tools and APIs quiz: details' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('First-attempt scores')).toBeInTheDocument();
    expect(within(sheet).getByRole('table', { name: 'Students by first-attempt score' })).toBeInTheDocument();
    const questions = within(sheet).getAllByRole('listitem');
    expect(questions).toHaveLength(3);
    expect(questions[0]).toHaveTextContent('What does a 429 status code from the API mean?');
    expect(questions[0]).toHaveTextContent('20% correct');
  });
});

describe('videos', () => {
  it('shows completion rates and a video’s rewind hotspots, most rewound first', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <VideoInsights videos={f.videos!} />
      </TooltipProvider>,
    );
    expect(screen.getByRole('figure', { name: 'Videos' })).toHaveAccessibleDescription(
      'Least finished: “Tutorial 3: Calling an API from a notebook”, completed by 65% of the students who started it.',
    );
    await user.click(screen.getByRole('button', { name: 'Tutorial 3: Calling an API from a notebook: details' }));
    const spots = within(await screen.findByRole('dialog')).getAllByRole('listitem');
    expect(spots[0]).toHaveTextContent('4:10');
    expect(spots[0]).toHaveTextContent('64 rewinds');
    expect(spots.map((s) => s.textContent?.match(/\d+:\d\d/)?.[0])).toEqual(['4:10', '10:10', '2:15']);
  });
});

describe('students to check on', () => {
  it('opens People filtered to the selected student', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(base);
    await user.click(await screen.findByRole('button', { name: /Rohit Verma/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: 'people', q: 'rohit@example.com' }));
    expect(await screen.findByRole('textbox', { name: 'Search people' })).toHaveValue('rohit@example.com');
    await waitFor(() =>
      expect(
        api.GET.mock.calls.some(
          ([p, o]) => p === ENROLLMENTS && (o as Opts).params?.query?.search === 'rohit@example.com',
        ),
      ).toBe(true),
    );
  });

  it('says everyone is active when nobody needs a nudge', () => {
    render(<StudentsToCheckOn students={[]} onOpenStudent={() => {}} />);
    expect(screen.getByRole('figure', { name: 'Students to check on' })).toHaveAccessibleDescription(
      'Everyone is active and moving.',
    );
  });

  it('typing in the People search keeps it in the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`${base}?tab=people`);
    await user.type(await screen.findByRole('textbox', { name: 'Search people' }), 'zoya');
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: 'people', q: 'zoya' }));
  });
});
