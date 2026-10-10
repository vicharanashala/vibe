import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, resetSession, signInStudent } from '@/test/session';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const course = fixtures.enrollments.enrollments[0];

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('home', () => {
  it('resumes the enrolled course at the backend’s current item', async () => {
    renderApp('/home');
    const card = (await screen.findByRole('heading', { name: course.course.name })).closest('div')!.parentElement!;
    expect(await within(card).findByText(fixtures.currentPath.item.name)).toBeInTheDocument();
    const p = fixtures.currentPath;
    await waitFor(() =>
      expect(within(card).getByRole('link', { name: /start course/i })).toHaveAttribute(
        'href',
        `/learn/${course.courseId}/${course.courseVersionId}/${p.module.id}/${p.section.id}/${p.item.id}?track=green`,
      ),
    );
  });

  it('asks for the required STUDENT role when listing enrolments', async () => {
    renderApp('/home');
    await screen.findByRole('heading', { name: course.course.name });
    expect(api.GET).toHaveBeenCalledWith('/api/users/enrollments', {
      params: { query: { page: 1, limit: 50, role: 'STUDENT', tab: 'active', search: '' } },
    });
  });

  it('shows an empty state when the student has no courses', async () => {
    api.GET.mockImplementation(async (path: string) =>
      path === '/api/users/enrollments'
        ? { data: { ...fixtures.enrollments, enrollments: [], totalDocuments: 0 }, error: undefined, response: new Response(null, { status: 200 }) }
        : { data: {}, error: undefined, response: new Response(null, { status: 200 }) },
    );
    renderApp('/home');
    expect(await screen.findByText('You don’t have any active courses')).toBeInTheDocument();
  });
});

describe('my courses', () => {
  it('lists a course once when the user is enrolled in it as both student and instructor', async () => {
    // The test double returns the same enrolment for both role queries.
    renderApp('/courses');
    await screen.findByRole('heading', { name: course.course.name });
    expect(api.GET).toHaveBeenCalledWith('/api/users/enrollments', {
      params: { query: expect.objectContaining({ role: 'INSTRUCTOR' }) },
    });
    expect(screen.getAllByRole('heading', { name: course.course.name })).toHaveLength(1);
  });

  it('lists enrolments with their lesson counts and searches through the API', async () => {
    const user = userEvent.setup();
    renderApp('/courses');
    expect(await screen.findByRole('heading', { name: course.course.name })).toBeInTheDocument();
    expect(screen.getByText(`${course.contentCounts.totalItems} lessons`)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search your courses' }), 'hash');
    await waitFor(() =>
      expect(api.GET).toHaveBeenCalledWith('/api/users/enrollments', {
        params: { query: expect.objectContaining({ search: 'hash' }) },
      }),
    );
  });
});

describe('course page', () => {
  it('renders the syllabus, marks the current item and reports unsigned consent', async () => {
    renderApp(`/courses/${course.courseId}/${course.courseVersionId}`);
    expect(await screen.findByRole('heading', { name: 'Syllabus' })).toBeInTheDocument();
    for (const m of fixtures.courseVersion.modules) {
      expect(screen.getByRole('heading', { name: m.name })).toBeInTheDocument();
    }
    // First section of the module holding the current item opens automatically.
    const upNext = await screen.findByText('Up next');
    expect(upNext.closest('li')).toHaveTextContent(fixtures.currentPath.item.name);
    expect(screen.getByText(/Not signed yet/)).toBeInTheDocument();
  });

  it('loads a section’s lessons only when it is expanded', async () => {
    const user = userEvent.setup();
    renderApp(`/courses/${course.courseId}/${course.courseVersionId}`);
    const second = fixtures.courseVersion.modules[1].sections[0];
    const toggle = await screen.findByRole('button', { name: second.name });
    const itemCalls = () =>
      api.GET.mock.calls.filter(([p]) => p === '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items').length;
    const before = itemCalls();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(itemCalls()).toBe(before + 1));
  });
});

describe('onboarding', () => {
  it('saves the student’s name to the backend before moving on', async () => {
    resetSession();
    signInStudent({ onboarded: false });
    const user = userEvent.setup();
    renderApp('/onboarding');
    const first = await screen.findByLabelText('First name');
    await user.clear(first);
    await user.type(first, 'Asha');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(api.PATCH).toHaveBeenCalledWith('/api/users/edit', { body: { firstName: 'Asha', lastName: 'Student' } });
    expect(await screen.findByRole('heading', { name: 'Check your camera and microphone' })).toBeInTheDocument();
  });
});
