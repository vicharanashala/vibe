import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, resetSession } from '@/test/session';
import { REGISTRATION, signInAdmin, studio } from '@/test/studio';

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const url = `/admin/courses/${REGISTRATION.courseId}/${REGISTRATION.versionId}?tab=registration`;
const [asha, gita] = studio.registration.requests.registrations;
const STATUS = '/api/course/registration/status/{registrationId}';
const BULK = '/api/course/registration/status/update/bulk';
const BUILD_FORM = '/api/course/registration/build-form/version/{versionId}';

beforeEach(() => {
  resetSession();
  signInAdmin();
});

describe('registration requests', () => {
  it('lists waiting requests with the student’s answers', async () => {
    const user = userEvent.setup();
    renderApp(url);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Asha Student')).toBeInTheDocument();
    expect(within(table).getByText('Gita Google')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Requests/ })).toHaveTextContent(
      '2',
    );

    await user.click(
      within(table).getAllByRole('button', { name: 'Answers' })[0],
    );
    const sheet = await screen.findByRole('dialog');
    // Answers are shown under each question's label, not its stored key.
    expect(within(sheet).getByText('Year of study')).toBeInTheDocument();
    expect(
      within(sheet).getByText(String(asha.detail.Year)),
    ).toBeInTheDocument();
  });

  it('approves one request directly', async () => {
    const user = userEvent.setup();
    renderApp(url);
    const table = await screen.findByRole('table');
    await user.click(
      within(table).getAllByRole('button', { name: 'Approve' })[0],
    );
    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith(STATUS, {
        params: { path: { registrationId: asha._id } },
        body: { status: 'APPROVED' },
      }),
    );
  });

  it('asks before declining, since the student is emailed', async () => {
    const user = userEvent.setup();
    renderApp(url);
    const table = await screen.findByRole('table');
    await user.click(
      within(table).getAllByRole('button', { name: 'Decline' })[1],
    );
    expect(api.PATCH).not.toHaveBeenCalledWith(STATUS, expect.anything());
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Decline',
      }),
    );
    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith(STATUS, {
        params: { path: { registrationId: gita._id } },
        body: { status: 'REJECTED' },
      }),
    );
  });

  it('approves selected requests in one go after confirming', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select all waiting requests',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Approve 2' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Approve 2 requests?',
    });
    await user.click(
      within(confirm).getByRole('button', { name: 'Approve 2' }),
    );
    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith(BULK, {
        body: { selected: [asha._id, gita._id] },
      }),
    );
  });
});

describe('registration form', () => {
  it('saves edits without reopening registration or dropping auto-approval, keeping stored keys', async () => {
    const user = userEvent.setup();
    const closed = {
      ...studio.registration.settings,
      isActive: false,
      registrationsAutoApproved: true,
      autoapproval_emails: ['@vibe.local'],
    };
    const base = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (path: string, opts: never) =>
      path === BUILD_FORM
        ? { data: closed, error: undefined, response: new Response() }
        : base(path, opts),
    );
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Form' }));

    // Edit "Year of study" (stored as "Year").
    const card = (await screen.findAllByRole('button', { name: 'Edit' }))[3];
    await user.click(card);
    const label = screen.getByDisplayValue('Year of study');
    await user.clear(label);
    await user.type(label, 'Current year');
    await user.click(screen.getByRole('button', { name: 'Save form' }));

    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(BUILD_FORM, expect.anything()),
    );
    const { body } = api.PUT.mock.calls.find((c) => c[0] === BUILD_FORM)![1];
    expect(body).toMatchObject({
      isActive: false,
      registrationsAutoApproved: true,
      autoapproval_emails: ['@vibe.local'],
    });
    expect(Object.keys(body.jsonSchema.properties)).toEqual(
      Object.keys(studio.registration.settings.jsonSchema.properties),
    );
    expect(body.jsonSchema.properties.Year).toMatchObject({
      title: 'Current year',
      enum: studio.registration.settings.jsonSchema.properties.Year.enum,
    });
    expect(body.jsonSchema.properties.Experience.type).toBe('integer');
  });

  it('only offers question types the student registration page can show', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Form' }));
    await user.click(
      await screen.findByRole('button', { name: /Add question/ }),
    );
    const menu = await screen.findByRole('menu');
    expect(
      within(menu).getByRole('menuitem', { name: /Dropdown/ }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole('menuitem', { name: /Rating/ }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('menuitem', { name: /Checkboxes/ }),
    ).not.toBeInTheDocument();
  });
});

describe('registration settings', () => {
  it('opens and closes registration', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.click(
      await screen.findByRole('switch', { name: 'Accepting registrations' }),
    );
    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith(
        '/api/course/registration/registration/version/{versionId}/toggle',
        {
          params: { path: { versionId: REGISTRATION.versionId } },
          body: { isActive: false },
        },
      ),
    );
  });

  it('saves auto-approval for matching emails only', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.click(
      await screen.findByRole('switch', { name: 'Approve automatically' }),
    );
    await user.type(
      screen.getByLabelText('Only for these emails (optional)'),
      '@iitrpr.ac.in{Enter}someone@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        '/api/course/registration/auto-approval/version/{versionId}',
        {
          params: { path: { versionId: REGISTRATION.versionId } },
          body: {
            registrationsAutoApproved: true,
            autoapproval_emails: ['@iitrpr.ac.in', 'someone@example.com'],
          },
        },
      ),
    );
  });
});
