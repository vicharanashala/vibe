import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import {
  pageOfEnrollments,
  SAMPLE,
  signInAdmin,
  studio,
  studioGet,
} from '@/test/studio';

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const ENROLLMENTS =
  '/api/users/enrollments/courses/{courseId}/versions/{versionId}';
const STATS = `${ENROLLMENTS}/statistics`;
const url = (tab: string) =>
  `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}?tab=${tab}`;

const [studentRow, instructorRow] = studio.enrollments.enrollments;
const student = (i: number) => ({
  ...studentRow,
  user: {
    ...studentRow.user,
    _id: `u${i}`,
    firstName: 'Student',
    lastName: `Number${i}`,
    email: `s${i}@example.com`,
  },
});
// Newest first, as the backend sends them: the instructor joined first, so comes last.
const everyone = [
  ...Array.from({ length: 120 }, (_, i) => student(i)),
  instructorRow,
];

type Opts = { params?: { query?: Record<string, unknown> } };

const listCalls = () =>
  api.GET.mock.calls
    .filter(([path]) => path === ENROLLMENTS)
    .map(([, opts]) => (opts as Opts).params?.query ?? {});

beforeEach(() => {
  resetSession();
  signInAdmin();
  api.GET.mockImplementation(async (path: string, opts?: Opts) => {
    if (path === ENROLLMENTS)
      return ok(pageOfEnrollments(everyone, opts?.params?.query));
    if (path === STATS)
      return ok({
        totalEnrollments: 120,
        completedCount: 7,
        averageProgressPercent: 41.6,
      });
    return studioGet(path, opts as never);
  });
});

describe('People, in a course bigger than one page', () => {
  const tab = (name: RegExp) => screen.findByRole('tab', { name });

  it('never relies on the backend default of 10', async () => {
    renderApp(url('people'));
    await screen.findByText('s0@example.com');
    expect(listCalls().every((q) => q.limit !== undefined)).toBe(true);
  });

  it('counts everyone in the tabs, not just the page on screen', async () => {
    renderApp(url('people'));
    expect(
      await within(await tab(/^All/)).findByText('121'),
    ).toBeInTheDocument();
    expect(
      await within(await tab(/^Students/)).findByText('120'),
    ).toBeInTheDocument();
    expect(
      await within(await tab(/^Instructors/)).findByText('1'),
    ).toBeInTheDocument();
  });

  it('finds instructors, who joined first, under their tab', async () => {
    const user = userEvent.setup();
    renderApp(url('people'));
    await screen.findByText('s0@example.com');
    expect(
      within(screen.getByRole('table')).queryByText(instructorRow.user.email),
    ).toBeNull();

    await user.click(await tab(/^Instructors/));
    expect(
      await within(screen.getByRole('table')).findByText(
        instructorRow.user.email,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('s0@example.com')).toBeNull();
  });

  it('pages through the rest, ending with the instructor', async () => {
    const user = userEvent.setup();
    renderApp(url('people'));
    await screen.findByText('Page 1 of 3');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('s50@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await within(screen.getByRole('table')).findByText(
        instructorRow.user.email,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('searches the whole course on the backend and starts again from page 1', async () => {
    const user = userEvent.setup();
    renderApp(url('people'));
    await screen.findByText('Page 1 of 3');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');

    await user.type(screen.getByLabelText('Search people'), 'Number119');
    expect(await screen.findByText('s119@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Page 1 of 3')).toBeNull();
    await waitFor(() =>
      expect(listCalls().at(-1)).toMatchObject({
        page: 1,
        search: 'Number119',
      }),
    );
    expect(listCalls().some((q) => q.search === 'N')).toBe(false);
  });

  it('says so when a search finds nobody, keeping the course’s counts', async () => {
    const user = userEvent.setup();
    renderApp(url('people'));
    await screen.findByText('s0@example.com');
    await user.type(screen.getByLabelText('Search people'), 'zzz');
    expect(await screen.findByText('No one matches.')).toBeInTheDocument();
    expect(
      await within(await tab(/^All/)).findByText('121'),
    ).toBeInTheDocument();
  });
});

describe('Overview, in a course bigger than one page', () => {
  it('shows the backend’s whole-course numbers', async () => {
    renderApp(url('overview'));
    const stat = async (label: string) =>
      (await screen.findByText(label)).parentElement;
    await waitFor(async () =>
      expect(await stat('Students')).toHaveTextContent('120'),
    );
    expect(await stat('Average progress')).toHaveTextContent('42%');
    expect(await stat('Finished')).toHaveTextContent('7');
    // The only list request is the short "Finished the course" preview, never the whole course.
    expect(listCalls()).toEqual([{ page: 1, limit: 5, filter: 'STUDENT', sortBy: 'progress', sortOrder: 'desc' }]);
  });
});
