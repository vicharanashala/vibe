import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { registrationErrorKind } from './queries';
import { toSubmission, validate, widgetFor, type FormSchema } from './schema-form';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const VERSION = fixtures.registrationDetails.course.versions[0];
const COURSE = fixtures.registrationDetails.courseId;
const LINK = `/register/${VERSION}`;

beforeEach(() => resetSession());

/** Answers one GET path with `data`, everything else from the default fixtures. */
function overrideGet(path: string, response: ReturnType<typeof ok> | { data: undefined; error: unknown; response: Response }) {
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, init: unknown) => (p === path ? response : fallback(p, init)));
}

const failWith = (message: string, status = 400) => ({ data: undefined, error: { message }, response: new Response(null, { status }) });

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Institution'), 'IIT Ropar');
  await user.selectOptions(screen.getByLabelText('Year of study'), '2nd year');
  await user.click(screen.getByText(/I will complete the course honestly/));
}

describe('registration link', () => {
  it('asks signed-out visitors to log in, then brings them back to the link', async () => {
    const { router } = renderApp(LINK);
    await screen.findByRole('heading', { name: 'Welcome back to ViBe' });
    expect(router.state.location.search).toEqual({ redirect: LINK });
    // …and the sign-up link keeps the way back too.
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', `/signup?redirect=${encodeURIComponent(LINK)}`);
  });

  it('sends new students through onboarding first, keeping the link', async () => {
    signInStudent({ onboarded: false });
    const { router } = renderApp(LINK);
    await screen.findByRole('heading', { name: 'What should we call you?' });
    expect(router.state.location.search).toEqual({ redirect: LINK });
  });

  it('redirects links shared from the previous frontend', async () => {
    signInStudent();
    const { router } = renderApp(`/student/course-registration/${VERSION}`);
    await screen.findByRole('heading', { name: 'Sample: Introduction to Algorithms' });
    expect(router.state.location.pathname).toBe(LINK);
  });

  it('shows the course with the form, Name and Email filled from the account', async () => {
    signInStudent();
    renderApp(LINK);
    expect(await screen.findByRole('heading', { name: 'Sample: Introduction to Algorithms' })).toBeInTheDocument();
    expect(screen.getByText('1 module')).toBeInTheDocument();
    expect(screen.getAllByText('Ira')[0]).toBeInTheDocument();
    expect(await screen.findByLabelText('Name')).toHaveValue('Asha Student');
    expect(screen.getByLabelText('Email')).toHaveValue('student@vibe.local');
    expect(screen.getByText('Sorting')).toBeInTheDocument();
  });

  it('explains what is missing instead of submitting', async () => {
    signInStudent();
    const user = userEvent.setup();
    renderApp(LINK);
    await user.click(await screen.findByRole('button', { name: 'Register' }));
    expect(screen.getByText('Institution is required.')).toBeInTheDocument();
    expect(screen.getByText('Year of study is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Institution')).toHaveFocus();
    expect(api.POST).not.toHaveBeenCalled();
  });

  it('submits the answers and shows "Request sent" when the course team approves manually', async () => {
    signInStudent();
    const user = userEvent.setup();
    renderApp(LINK);
    await fillRequired(user);
    await user.click(screen.getByText('Weekends'));
    await user.type(screen.getByLabelText(/Years of programming experience/), '2');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('status', { name: 'Request sent' })).toBeInTheDocument();
    expect(api.POST).toHaveBeenCalledWith('/api/course/registration/version/{versionId}', {
      params: { path: { versionId: VERSION } },
      body: {
        Name: 'Asha Student',
        Email: 'student@vibe.local',
        Institution: 'IIT Ropar',
        Year: '2nd year',
        Mode: 'Weekends',
        Experience: 2,
        Agree: true,
        recaptchaToken: 'NO_CAPTCHA',
      },
    });
  });

  it('lets auto-approved students straight into the course', async () => {
    signInStudent();
    api.POST.mockResolvedValueOnce(ok({ registrationId: 'r1', status: 'APPROVED' }, 201));
    const user = userEvent.setup();
    renderApp(LINK);
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));

    const card = await screen.findByRole('status', { name: 'You’re in' });
    expect(within(card).getByRole('link', { name: /start learning/i })).toHaveAttribute('href', `/courses/${COURSE}/${VERSION}`);
  });

  it('treats "already registered" from the backend as a sent request', async () => {
    signInStudent();
    api.POST.mockResolvedValueOnce(failWith('You are already registered for this course'));
    const user = userEvent.setup();
    renderApp(LINK);
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('status', { name: 'Request sent' })).toBeInTheDocument();
  });

  it('shows other backend errors next to the button', async () => {
    signInStudent();
    api.POST.mockResolvedValueOnce(failWith('Cohort information is required for registration'));
    const user = userEvent.setup();
    renderApp(LINK);
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cohort information is required');
  });

  it('shows a pending request instead of the form', async () => {
    signInStudent();
    overrideGet('/api/course/registration/pending/student', ok(fixtures.registrationPending));
    renderApp(LINK);
    expect(await screen.findByRole('status', { name: 'Request sent' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
  });

  it('sends enrolled students to the course', async () => {
    signInStudent();
    const enrolled = { ...fixtures.enrollments.enrollments[0], courseId: COURSE, courseVersionId: VERSION };
    overrideGet('/api/users/enrollments', ok({ ...fixtures.enrollments, enrollments: [enrolled] }));
    renderApp(LINK);
    const card = await screen.findByRole('status', { name: 'You’re already in this course' });
    expect(within(card).getByRole('link', { name: /go to course/i })).toHaveAttribute('href', `/courses/${COURSE}/${VERSION}`);
  });

  it('says so when registration is closed', async () => {
    signInStudent();
    overrideGet('/api/course/registration/form/version/{versionId}', ok({ ...fixtures.registrationForm, isActive: false }));
    renderApp(LINK);
    expect(await screen.findByRole('status', { name: 'Registration is closed' })).toBeInTheDocument();
  });

  it('lists pending registrations on Home', async () => {
    signInStudent();
    overrideGet('/api/course/registration/pending/student', ok(fixtures.registrationPending));
    renderApp('/home');
    const section = await screen.findByRole('region', { name: 'Waiting for approval' });
    expect(within(section).getByRole('link', { name: /Sample: Introduction to Algorithms/ })).toHaveAttribute('href', LINK);
  });
});

describe('registration form schema', () => {
  const schema = fixtures.registrationForm.jsonSchema as FormSchema;

  it('picks the widget the instructor chose', () => {
    const ui = fixtures.registrationForm.uiSchema;
    const p = schema.properties!;
    expect(widgetFor(p.Year, ui.Year)).toBe('select');
    expect(widgetFor(p.Mode, ui.Mode)).toBe('radio');
    expect(widgetFor(p.Experience, ui.Experience)).toBe('number');
    expect(widgetFor(p.StartDate, ui.StartDate)).toBe('date');
    expect(widgetFor(p.Motivation, ui.Motivation)).toBe('textarea');
    expect(widgetFor(p.Email, ui.Email)).toBe('email');
    expect(widgetFor(p.Agree, ui.Agree)).toBe('checkbox');
  });

  it('validates email, number ranges and whole numbers', () => {
    const errors = validate(schema, { Name: 'A', Email: 'nope', Institution: 'X', Year: '1st year', Experience: '41', Agree: false });
    expect(errors).toEqual({ Email: 'Enter a valid email address.', Experience: 'Must be at most 40.' });
    expect(validate(schema, { Name: 'A', Email: 'a@b.co', Institution: 'X', Year: '1st year', Experience: '1.5' }).Experience).toBe('Enter a whole number.');
  });

  it('drops empty optional answers and converts numbers', () => {
    expect(toSubmission(schema, { Name: ' A ', Email: 'a@b.co', Institution: 'X', Year: '1st year', Mode: '', Experience: '3', Motivation: '', Agree: false })).toEqual({
      Name: 'A',
      Email: 'a@b.co',
      Institution: 'X',
      Year: '1st year',
      Experience: 3,
      Agree: false,
    });
  });

  it('recognises the backend messages it can recover from', () => {
    expect(registrationErrorKind('You are already registered for this cohort of the course')).toBe('already-registered');
    expect(registrationErrorKind('You are already enrolled in this course')).toBe('already-enrolled');
    expect(registrationErrorKind('Course registration is not active')).toBe('closed');
    expect(registrationErrorKind('Something else')).toBeNull();
  });
});
