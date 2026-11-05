import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, respond, signInStudent } from '@/test/session';
import { REGISTRATION, signInAdmin } from '@/test/studio';

import { PUBLIC_PAGE_SIZE } from './queries';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

// Captured from the local backend: "Sample: Introduction to Algorithms" marked public.
const [algorithms] = fixtures.publicCourses.courses;
const PUBLIC = '/api/courses/public';

/** Serves `catalogue` for GET /courses/public, the usual student fixtures otherwise. */
function serveCatalogue(catalogue: (query: Record<string, unknown>) => unknown) {
  api.GET.mockImplementation(async (path: string, opts?: { params?: { query?: Record<string, unknown> } }) =>
    path === PUBLIC ? ok(catalogue(opts?.params?.query ?? {})) : respond(path),
  );
}

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('explore courses', () => {
  it('lists open courses, each leading to its registration page', async () => {
    serveCatalogue(() => fixtures.publicCourses);
    renderApp('/explore');
    const card = await screen.findByRole('link', { name: `Register for ${algorithms.courseName}` });
    expect(card).toHaveAttribute('href', `/register/${algorithms.courseVersionId}`);
    expect(within(card).getByText(algorithms.courseDescription)).toBeInTheDocument();
  });

  it('opens a public cohort’s own registration page', async () => {
    const cohort = { ...algorithms, type: 'COHORT', cohortId: 'cohort-1', cohortName: 'Weekend batch' };
    serveCatalogue(() => ({ ...fixtures.publicCourses, courses: [cohort] }));
    renderApp('/explore');
    const card = await screen.findByRole('link', { name: `Register for ${algorithms.courseName}, Weekend batch` });
    expect(card).toHaveAttribute('href', `/register/${algorithms.courseVersionId}/cohort-1`);
  });

  it('marks courses the student already asked to join', async () => {
    serveCatalogue(() => fixtures.publicCourses);
    const base = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (p: string, o: never) =>
      p === '/api/course/registration/pending/student'
        ? ok([{ _id: 'r1', versionId: algorithms.courseVersionId, courseId: algorithms.courseId, courseName: algorithms.courseName, cohortId: null, status: 'PENDING', createdAt: '2026-10-18T10:00:00Z', updatedAt: null }])
        : base(p, o),
    );
    renderApp('/explore');
    expect(await screen.findByRole('link', { name: `Request sent for ${algorithms.courseName}` })).toBeInTheDocument();
  });

  it('searches the catalogue', async () => {
    serveCatalogue((q) => (q.search ? { ...fixtures.publicCourses, courses: [] } : fixtures.publicCourses));
    const user = userEvent.setup();
    renderApp('/explore');
    await screen.findByRole('link', { name: `Register for ${algorithms.courseName}` });
    await user.type(screen.getByRole('searchbox', { name: 'Search courses' }), 'graphs');
    expect(await screen.findByText('No courses match “graphs”')).toBeInTheDocument();
    expect(api.GET).toHaveBeenCalledWith(PUBLIC, { params: { query: { page: 1, limit: PUBLIC_PAGE_SIZE, search: 'graphs' } } });
  });

  it('loads the next page only when a full page came back', async () => {
    // The backend's totals describe just the returned page, so a full page means "maybe more".
    const page = (n: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({ ...algorithms, courseVersionId: `v${n}-${i}`, courseName: `Course ${n}-${i}` }));
    serveCatalogue((q) => ({ ...fixtures.publicCourses, courses: q.page === 1 ? page(1, PUBLIC_PAGE_SIZE) : page(2, 2) }));
    const user = userEvent.setup();
    renderApp('/explore');
    await user.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('link', { name: 'Register for Course 2-1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('shows a few open courses on the home page', async () => {
    serveCatalogue(() => fixtures.publicCourses);
    renderApp('/home');
    const section = (await screen.findByRole('heading', { name: 'Explore courses' })).closest('section')!;
    expect(within(section).getByRole('link', { name: `Register for ${algorithms.courseName}` })).toBeInTheDocument();
  });

  it('leaves the home page as it was when nothing is open', async () => {
    renderApp('/home');
    await screen.findByRole('heading', { name: 'Continue learning' });
    await waitFor(() => expect(api.GET).toHaveBeenCalledWith(PUBLIC, expect.anything()));
    expect(screen.queryByRole('heading', { name: 'Explore courses' })).not.toBeInTheDocument();
  });
});

describe('course catalogue switch (studio)', () => {
  it('lists a course while sending every other setting back unchanged', async () => {
    signInAdmin();
    const user = userEvent.setup();
    renderApp(`/admin/courses/${REGISTRATION.courseId}/${REGISTRATION.versionId}?tab=registration`);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    const toggle = await screen.findByRole('switch', { name: 'List in the course catalogue' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    const PUT = '/api/setting/course-setting/{courseId}/{versionId}/proctoring';
    await waitFor(() => expect(api.PUT).toHaveBeenCalledWith(PUT, expect.anything()));
    const body = api.PUT.mock.calls.find((c) => c[0] === PUT)![1].body;
    const { proctors, ...rest } = fixtures.courseSettings.settings;
    // The endpoint replaces every setting (and treats a missing isPublic as false).
    expect(body).toEqual({
      ...rest,
      isPublic: true,
      detectors: proctors.detectors.map((d: { detectorName: string; settings: { enabled: boolean } }) => ({
        detectorName: d.detectorName,
        settings: { enabled: d.settings.enabled },
      })),
    });
  });
});
