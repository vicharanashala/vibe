import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { pageOfEnrollments, SAMPLE, signInAdmin, studio, studioGet } from '@/test/studio';

import { nextSort, parsePeopleSort } from './people-sort';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const ENROLLMENTS = '/api/users/enrollments/courses/{courseId}/versions/{versionId}';
const STATS = `${ENROLLMENTS}/statistics`;
const base = `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}`;

const [studentRow, instructorRow] = studio.enrollments.enrollments;
/** Student `i` joined on day `i` of March and has `progress` percent. */
const student = (i: number, first: string, progress: number) => ({
  ...studentRow,
  progress,
  enrollmentDate: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
  user: { ...studentRow.user, _id: `u${i}`, firstName: first, lastName: 'Test', email: `${first.toLowerCase()}@example.com` },
});
// 70 students, so the course is more than one page of 50. Three have finished.
const names = Array.from({ length: 70 }, (_, i) => `Name${String(i).padStart(2, '0')}`);
const students = names.map((n, i) => student(i, n, i % 10 === 0 ? 0 : 30));
students[5] = student(5, 'Zoya', 100);
students[40] = student(40, 'Aarav', 100);
students[66] = student(66, 'Meera', 100);
// Newest first, as the backend sends them by default.
const everyone = [...students].reverse().concat({ ...instructorRow, enrollmentDate: '2026-01-01T10:00:00.000Z' });

type Opts = { params?: { query?: Record<string, unknown> } };
const listCalls = () =>
  api.GET.mock.calls.filter(([path]) => path === ENROLLMENTS).map(([, o]) => (o as Opts).params?.query ?? {});
/** The table's own requests, not the one-row requests behind the tab counts. */
const tableCalls = () => listCalls().filter((q) => q.limit === 50);

let completed = 3;
beforeEach(() => {
  completed = 3;
  resetSession();
  signInAdmin();
  api.GET.mockImplementation(async (path: string, opts?: Opts) => {
    if (path === ENROLLMENTS) return ok(pageOfEnrollments(everyone, opts?.params?.query));
    if (path === STATS) return ok({ totalEnrollments: 70, completedCount: completed, averageProgressPercent: 31 });
    return studioGet(path, opts as never);
  });
});

const firstRowEmail = async () => {
  const table = await screen.findByRole('table');
  const rows = within(table).getAllByRole('row').slice(1);
  return within(rows[0]).getByText(/@/).textContent;
};

describe('sorting People', () => {
  it('starts newest first, as before', async () => {
    renderApp(`${base}?tab=people`);
    expect(await screen.findByRole('columnheader', { name: /Joined/ })).toHaveAttribute('aria-sort', 'descending');
    await waitFor(async () => expect(await firstRowEmail()).toBe('name69@example.com'));
  });

  it('asks the backend to sort the whole course by the clicked column, and flips on a second click', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`${base}?tab=people`);
    await screen.findByText('name69@example.com');

    await user.click(screen.getByRole('button', { name: 'Progress' }));
    await waitFor(async () => expect(await firstRowEmail()).toMatch(/zoya|aarav|meera/));
    expect(tableCalls().at(-1)).toMatchObject({ sortBy: 'progress', sortOrder: 'desc', page: 1 });
    expect(router.state.location.search).toMatchObject({ tab: 'people', sort: 'progress', order: 'desc' });
    expect(screen.getByRole('columnheader', { name: /Progress/ })).toHaveAttribute('aria-sort', 'descending');

    await user.click(screen.getByRole('button', { name: 'Progress' }));
    await waitFor(() => expect(tableCalls().at(-1)).toMatchObject({ sortBy: 'progress', sortOrder: 'asc' }));

    await user.click(screen.getByRole('button', { name: /Person/ }));
    await waitFor(async () => expect(await firstRowEmail()).toBe('aarav@example.com'));
    expect(tableCalls().at(-1)).toMatchObject({ sortBy: 'name', sortOrder: 'asc' });
  });

  it('goes back to page 1 when the order changes', async () => {
    const user = userEvent.setup();
    renderApp(`${base}?tab=people`);
    await screen.findByText('name69@example.com');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');
    await user.click(screen.getByRole('button', { name: /Person/ }));
    await screen.findByText('Page 1 of 2');
  });

  it('keeps the order from the URL', async () => {
    renderApp(`${base}?tab=people&sort=name&order=desc`);
    await waitFor(async () => expect(await firstRowEmail()).toBe('zoya@example.com'));
    expect(tableCalls().at(-1)).toMatchObject({ sortBy: 'name', sortOrder: 'desc' });
  });

  it('sorts from the menu used on small screens', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`${base}?tab=people`);
    await screen.findByText('name69@example.com');
    await user.click(screen.getByRole('button', { name: 'Sort people' }));
    const option = await screen.findByRole('menuitemradio', { name: 'Most progress' });
    option.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toMatchObject({ sort: 'progress', order: 'desc' }));
    await waitFor(async () => expect(await firstRowEmail()).toMatch(/zoya|aarav|meera/));
  });

  it('ignores a sort it doesn’t offer', () => {
    expect(parsePeopleSort('email', 'asc')).toBeUndefined();
    expect(parsePeopleSort('progress', 'sideways')).toBeUndefined();
    expect(parsePeopleSort('progress', 'asc')).toEqual({ by: 'progress', order: 'asc' });
  });

  it('starts each column in its natural direction', () => {
    const current = { by: 'enrollmentDate', order: 'desc' } as const;
    expect(nextSort(current, 'name')).toEqual({ by: 'name', order: 'asc' });
    expect(nextSort(current, 'progress')).toEqual({ by: 'progress', order: 'desc' });
    expect(nextSort(current, 'enrollmentDate')).toEqual({ by: 'enrollmentDate', order: 'asc' });
  });
});

describe('Overview: who finished', () => {
  it('names the students at 100% and opens People sorted by progress', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(base);
    const section = await screen.findByRole('region', { name: 'Finished the course' });
    for (const email of ['zoya@example.com', 'aarav@example.com', 'meera@example.com'])
      expect(await within(section).findByText(email)).toBeInTheDocument();
    expect(within(section).queryByText(/name\d+@example.com/)).not.toBeInTheDocument();
    expect(listCalls()).toContainEqual(expect.objectContaining({ filter: 'STUDENT', sortBy: 'progress', sortOrder: 'desc' }));

    await user.click(within(section).getByRole('button', { name: 'See in People' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: 'people', sort: 'progress', order: 'desc' }));
    await waitFor(async () => expect(await firstRowEmail()).toMatch(/zoya|aarav|meera/));
  });

  it('offers the full count when more finished than it shows', async () => {
    completed = 37;
    renderApp(base);
    const section = await screen.findByRole('region', { name: 'Finished the course' });
    expect(await within(section).findByRole('button', { name: 'See all 37' })).toBeInTheDocument();
  });

  it('says so when no one has finished', async () => {
    completed = 0;
    api.GET.mockImplementation(async (path: string, opts?: Opts) => {
      if (path === ENROLLMENTS) return ok(pageOfEnrollments(students.map((s) => ({ ...s, progress: 30 })), opts?.params?.query));
      if (path === STATS) return ok({ totalEnrollments: 70, completedCount: 0, averageProgressPercent: 30 });
      return studioGet(path, opts as never);
    });
    renderApp(base);
    expect(await screen.findByText('No student has reached 100% yet.')).toBeInTheDocument();
  });
});
