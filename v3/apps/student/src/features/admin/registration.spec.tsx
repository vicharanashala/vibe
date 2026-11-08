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
      autoApprovalMode: 'LIST',
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
      autoApprovalMode: 'LIST',
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

  const AUTO_APPROVAL =
    '/api/course/registration/auto-approval/version/{versionId}';

  function withSettings(overrides: Record<string, unknown>) {
    const base = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (path: string, opts: never) =>
      path === BUILD_FORM
        ? {
            data: { ...studio.registration.settings, ...overrides },
            error: undefined,
            response: new Response(),
          }
        : base(path, opts),
    );
  }

  it('saves auto-approval for matching emails only', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.click(
      await screen.findByRole('switch', { name: 'Approve automatically' }),
    );
    await user.click(screen.getByRole('radio', { name: 'Only these emails' }));
    await user.type(
      screen.getByLabelText('Emails and domains'),
      'iitrpr.ac.in{Enter}someone@example.com',
    );
    // Not added with Enter: Save picks up what's still in the box.
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(AUTO_APPROVAL, {
        params: { path: { versionId: REGISTRATION.versionId } },
        body: {
          registrationsAutoApproved: true,
          autoApprovalMode: 'LIST',
          autoapproval_emails: ['iitrpr.ac.in', 'someone@example.com'],
        },
      }),
    );
  });

  it('shows no list for a course that approves everyone', async () => {
    const user = userEvent.setup();
    withSettings({ registrationsAutoApproved: true });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));

    expect(
      await screen.findByRole('radio', { name: 'Everyone' }),
    ).toBeChecked();
    expect(screen.queryByLabelText('Emails and domains')).toBeNull();
  });

  it('saves everyone without needing any entries', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: ['bob@gmail.com'],
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.click(await screen.findByRole('radio', { name: 'Everyone' }));
    expect(screen.queryByLabelText('Emails and domains')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(AUTO_APPROVAL, {
        params: { path: { versionId: REGISTRATION.versionId } },
        body: {
          registrationsAutoApproved: true,
          autoApprovalMode: 'EVERYONE',
          autoapproval_emails: [],
        },
      }),
    );
  });

  it('shows the saved list, with the exact-matching rules', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: ['bob@gmail.com'],
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));

    expect(
      await screen.findByRole('radio', { name: 'Only these emails' }),
    ).toBeChecked();
    expect(
      screen.getByRole('cell', { name: 'bob@gmail.com' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 email')).toBeInTheDocument();
    expect(
      screen.getByText(/A full address matches only that address/),
    ).toHaveTextContent('not its subdomains');
    expect(screen.queryByText(/contains any/)).toBeNull();
    expect(screen.queryByText(/Nobody will be approved/)).toBeNull();
  });

  it('warns that an empty list approves nobody', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: [],
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));

    expect(
      await screen.findByText(/Nobody will be approved automatically/),
    ).toBeInTheDocument();
  });

  it('explains a mistyped entry and keeps it in the box to correct', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: [],
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    const box = await screen.findByLabelText('Emails and domains');
    await user.type(box, 'iitm, bob@gmail.com{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('domain: iitm');
    expect(box).toHaveValue('iitm');
    expect(
      screen.getByRole('cell', { name: 'bob@gmail.com' }),
    ).toBeInTheDocument();
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it('does not save while the box holds a mistyped entry', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: ['bob@gmail.com'],
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.type(await screen.findByLabelText('Emails and domains'), 'iitm');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('domain: iitm');
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it('shows an error from the server when saving fails', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: [],
    });
    api.PUT.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Something went wrong on the server' },
      response: new Response(null, { status: 400 }),
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.type(
      await screen.findByLabelText('Emails and domains'),
      'bob@gmail.com{Enter}',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Something went wrong on the server'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'bob@gmail.com' }),
    ).toBeInTheDocument();
  });

  it('marks an old entry that is not valid, and lets it be removed', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: ['iitm', 'bob@gmail.com'],
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));

    expect(await screen.findByText('Not valid')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove iitm' }));
    expect(screen.queryByText('Not valid')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        AUTO_APPROVAL,
        expect.objectContaining({
          body: expect.objectContaining({
            autoapproval_emails: ['bob@gmail.com'],
          }),
        }),
      ),
    );
  });

  it('searches the list', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: Array.from(
        { length: 9 },
        (_, i) => `s${i}@example.com`,
      ),
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.type(await screen.findByLabelText('Search the list'), 's3@');

    expect(
      screen.getByRole('cell', { name: 's3@example.com' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 's4@example.com' })).toBeNull();
  });

  it('stops a list too long for the server, with a reason', async () => {
    const user = userEvent.setup();
    withSettings({
      registrationsAutoApproved: true,
      autoApprovalMode: 'LIST',
      autoapproval_emails: Array.from(
        { length: 5000 },
        (_, i) => `student${i}@example.com`,
      ),
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Remove student0@example.com',
      }),
    );

    expect(screen.getByText(/too long to save/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  describe('uploading a CSV', () => {
    const CSV =
      'Name,Roll,Email\nAsha,1,Asha@Example.com\nGita,2,gita@example.com\n' +
      'Asha again,3,asha@example.com\nBob,4,bob@gmail.com\nNo mail,5,gmail.com\n';
    // jsdom's File has no text(); a real browser's is checked end to end.
    const file = (text: string, name = 'students.csv') =>
      Object.assign(new File([text], name, { type: 'text/csv' }), {
        text: async () => text,
      });

    async function openDialog(entries: string[] = ['bob@gmail.com']) {
      const user = userEvent.setup({ applyAccept: false });
      withSettings({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: entries,
      });
      renderApp(url);
      await user.click(await screen.findByRole('tab', { name: 'Settings' }));
      await user.click(
        await screen.findByRole('button', { name: 'Upload CSV' }),
      );
      return user;
    }

    it('picks the email column, reports what it found, and adds on Save', async () => {
      const user = await openDialog();
      await user.upload(screen.getByLabelText('CSV file'), file(CSV));

      const column = await screen.findByLabelText('Column with the emails');
      expect(column).toHaveDisplayValue('Email');
      expect(screen.getByText('2 new emails to add')).toBeInTheDocument();
      expect(screen.getByText('1 already on the list.')).toBeInTheDocument();
      expect(
        screen.getByText('1 repeat in the file will be added once.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/skipped because it isn't an email: gmail\.com/),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Add 2 emails' }));
      expect(api.PUT).not.toHaveBeenCalled();
      expect(
        await screen.findByRole('cell', { name: 'asha@example.com' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Not saved yet.')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(api.PUT).toHaveBeenCalledWith(
          AUTO_APPROVAL,
          expect.objectContaining({
            body: expect.objectContaining({
              autoapproval_emails: [
                'bob@gmail.com',
                'asha@example.com',
                'gita@example.com',
              ],
            }),
          }),
        ),
      );
    });

    it('lets the teacher choose another column, and adds nothing from a wrong one', async () => {
      const user = await openDialog([]);
      await user.upload(
        screen.getByLabelText('CSV file'),
        file('Work email,Name,Personal email\na@x.com,A,p@y.com\nb@x.com,B,\n'),
      );

      const column = await screen.findByLabelText('Column with the emails');
      expect(column).toHaveDisplayValue('Work email');
      await user.selectOptions(column, 'Personal email');
      expect(screen.getByText('1 new email to add')).toBeInTheDocument();
      await user.selectOptions(column, 'Name');
      expect(
        screen.getByText(/No email addresses in this column/),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add emails' })).toBeDisabled();
    });

    it('refuses a file that would make the list too long to save', async () => {
      const user = await openDialog();
      const rows = Array.from(
        { length: 5000 },
        (_, i) => `student${i}@example.com`,
      );
      await user.upload(
        screen.getByLabelText('CSV file'),
        file(`Email\n${rows.join('\n')}`),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /too long to save/,
      );
      expect(
        screen.getByRole('button', { name: 'Add 5,000 emails' }),
      ).toBeDisabled();
    });

    it('refuses an Excel workbook and explains what to do', async () => {
      const user = await openDialog();
      await user.upload(
        screen.getByLabelText('CSV file'),
        file('PK\u0003\u0004\0\0binary', 'students.xlsx'),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /save or download it as CSV/,
      );
    });
  });
});
