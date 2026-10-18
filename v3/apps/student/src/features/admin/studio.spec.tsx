import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, resetSession, signInStudent } from '@/test/session';
import { SAMPLE, signInAdmin, studio } from '@/test/studio';

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

beforeEach(() => {
  resetSession();
});

describe('studio access', () => {
  it('keeps non-admins out of every studio page', async () => {
    signInStudent();
    renderApp(`/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}`);
    expect(await screen.findByText('Admins only')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: SAMPLE.name }),
    ).not.toBeInTheDocument();
  });

  it('uses the app-wide theme, not a studio-only one', async () => {
    signInAdmin();
    localStorage.setItem('palette', 'sage');
    renderApp('/admin');
    await screen.findByRole('heading', { name: /Welcome back, Ira/ });
    expect(document.documentElement.dataset.palette).toBe('sage');
    expect(document.documentElement.classList.contains('studio')).toBe(false);
  });
});

describe('studio home', () => {
  beforeEach(() => signInAdmin());

  it('shows overview numbers from the courses and users APIs', async () => {
    renderApp('/admin');
    const overview = (await screen.findByRole('heading', { name: 'Overview' }))
      .parentElement!.parentElement!;
    await waitFor(() =>
      expect(
        within(overview).getByText('Courses').nextElementSibling,
      ).toHaveTextContent(String(studio.courses.courses.length)),
    );
    expect(
      within(overview).getByText('Users').nextElementSibling,
    ).toHaveTextContent(String(studio.users.users.length));
  });

  it('offers New course from the bottom bar on phones and the sidebar on desktop', async () => {
    renderApp('/admin');
    const buttons = await screen.findAllByRole('button', {
      name: /new course/i,
    });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    await userEvent.setup().click(buttons[buttons.length - 1]);
    expect(
      await screen.findByRole('dialog', { name: 'New course' }),
    ).toBeInTheDocument();
  });
});

describe('courses', () => {
  beforeEach(() => signInAdmin());

  it('lists every course and filters by search', async () => {
    const user = userEvent.setup();
    renderApp('/admin/courses');
    expect(
      await screen.findByText(`${studio.courses.courses.length} courses`),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Search courses' }),
      'algorithms',
    );
    expect(
      screen.getByText('Sample: Introduction to Algorithms'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Sample: Foundations of Data Structures'),
    ).not.toBeInTheDocument();
  });

  it('creates a course with its first version and opens its content', async () => {
    const user = userEvent.setup();
    api.POST.mockImplementation(async (path: string) =>
      path === '/api/courses/'
        ? {
            data: { _id: SAMPLE.courseId, versions: [SAMPLE.versionId] },
            error: undefined,
            response: new Response(null, { status: 201 }),
          }
        : { data: {}, error: undefined, response: new Response() },
    );
    const { router } = renderApp('/admin/courses');
    await user.click(
      (await screen.findAllByRole('button', { name: /new course/i }))[0],
    );
    const dialog = await screen.findByRole('dialog', { name: 'New course' });
    await user.type(within(dialog).getByLabelText('Course name'), 'Graphs');
    await user.type(
      within(dialog).getByLabelText('Description'),
      'Paths and trees.',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Create course' }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}`,
      ),
    );
    expect(router.state.location.search).toEqual({ tab: 'content' });
    expect(api.POST).toHaveBeenCalledWith('/api/courses/', {
      body: {
        name: 'Graphs',
        description: 'Paths and trees.',
        versionName: 'Version 1',
        versionDescription: '',
        hpSystem: false,
        baseHp: 0,
      },
    });
  });
});

describe('course page', () => {
  beforeEach(() => signInAdmin());
  const base = `/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}`;

  it('switches tabs through the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(base);
    expect(
      await screen.findByRole('heading', { name: SAMPLE.name }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'People' }));
    expect(router.state.location.search).toEqual({ tab: 'people' });
    const table = await screen.findByRole('table');
    for (const e of studio.enrollments.enrollments)
      expect(await within(table).findByText(e.user.email)).toBeInTheDocument();
  });

  it('invites several people in one request', async () => {
    const user = userEvent.setup();
    renderApp(`${base}?tab=people`);
    await user.click(await screen.findByRole('button', { name: /^invite$/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite people' });
    await user.click(within(dialog).getByRole('tab', { name: 'Instructor' }));
    await user.type(
      within(dialog).getByLabelText('Emails'),
      'a@example.com, b@example.com ',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Send 2 invites' }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: 'Send 2 invites' }),
    );
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        '/api/notifications/invite/courses/{courseId}/versions/{versionId}',
        {
          params: {
            path: { courseId: SAMPLE.courseId, versionId: SAMPLE.versionId },
          },
          body: {
            inviteData: [
              { email: 'a@example.com', role: 'INSTRUCTOR' },
              { email: 'b@example.com', role: 'INSTRUCTOR' },
            ],
          },
        },
      ),
    );
  });

  it('rejects an address that isn’t an email before sending', async () => {
    const user = userEvent.setup();
    renderApp(`${base}?tab=people`);
    await user.click(await screen.findByRole('button', { name: /^invite$/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite people' });
    await user.type(
      within(dialog).getByLabelText('Emails'),
      'not-an-email{Enter}',
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Not an email: not-an-email',
    );
    expect(api.POST).not.toHaveBeenCalledWith(
      '/api/notifications/invite/courses/{courseId}/versions/{versionId}',
      expect.anything(),
    );
  });

  it('saves proctoring switches with the rest of the settings untouched', async () => {
    const user = userEvent.setup();
    renderApp(`${base}?tab=proctoring`);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.click(await screen.findByRole('switch', { name: /Face count/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        '/api/setting/course-setting/{courseId}/{versionId}/proctoring',
        expect.anything(),
      ),
    );
    const body = api.PUT.mock.calls.find(
      (c) =>
        c[0] ===
        '/api/setting/course-setting/{courseId}/{versionId}/proctoring',
    )![1].body;
    expect(
      body.detectors.find(
        (d: { detectorName: string }) =>
          d.detectorName === 'faceCountDetection',
      ).settings.enabled,
    ).toBe(true);
    expect(body.detectors).toHaveLength(8);
  });
});

describe('users', () => {
  beforeEach(() => signInAdmin());

  it('asks before making someone an admin', async () => {
    const user = userEvent.setup();
    renderApp('/admin/users');
    const student = studio.users.users.find((u) => u.roles !== 'admin')!;
    await user.click(
      await screen.findByRole('button', {
        name: `Actions for ${student.email}`,
      }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: /make admin/i }),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(student.email);
    expect(api.POST).not.toHaveBeenCalledWith(
      '/api/users/make-admin/{userId}',
      expect.anything(),
    );
    await user.click(
      within(confirm).getByRole('button', { name: 'Make admin' }),
    );
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        '/api/users/make-admin/{userId}',
        expect.objectContaining({
          params: { path: { userId: expect.any(String) } },
        }),
      ),
    );
  });
});
