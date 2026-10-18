import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, resetSession, signInStudent } from '@/test/session';
import { FEEDBACK, signInTeacher } from '@/test/studio';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

// Tara is a regular user (roles: "user") who teaches "Studio feedback test" as INSTRUCTOR.
const course = `/admin/courses/${FEEDBACK.courseId}/${FEEDBACK.versionId}`;

beforeEach(() => resetSession());

describe('studio for teachers who aren’t admins', () => {
  it('opens with the courses they teach, without admin-only parts', async () => {
    signInTeacher();
    renderApp('/admin/courses');
    expect(await screen.findByRole('link', { name: /Studio feedback test/ })).toBeInTheDocument();
    expect(screen.getByText('1 course')).toBeInTheDocument();
    // Creating courses and listing every user are admin-only on the backend.
    expect(screen.queryByRole('button', { name: /New course/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(api.GET).not.toHaveBeenCalledWith('/api/courses/', expect.anything());
    expect(api.GET).not.toHaveBeenCalledWith('/api/users/', expect.anything());
  });

  it('asks only for the teaching roles that open the studio', async () => {
    signInTeacher();
    renderApp('/admin');
    await screen.findByRole('heading', { name: /Welcome back, Tara/ });
    const roles = api.GET.mock.calls.filter((c) => c[0] === '/api/users/enrollments').map((c) => c[1].params.query.role);
    expect(new Set(roles)).toEqual(new Set(['INSTRUCTOR', 'MANAGER', 'TA']));
    expect(screen.queryByRole('heading', { name: 'Overview' })).not.toBeInTheDocument();
  });

  it('explains the Users page is for admins', async () => {
    signInTeacher();
    renderApp('/admin/users');
    expect(await screen.findByText('Admins only')).toBeInTheDocument();
    expect(api.GET).not.toHaveBeenCalledWith('/api/users/', expect.anything());
  });

  it('leaves removing students and deciding appeals to admins', async () => {
    const appeal = {
      _id: 'a1',
      userId: '6ac6703d4ec7ef17228a73bd',
      status: 'PENDING',
      reason: 'My webcam froze.',
      evidenceImages: [],
      createdAt: '2026-10-18T11:00:00.000Z',
      student: { id: '6ac6703d4ec7ef17228a73bd', firstName: 'Asha', lastName: 'Student', email: 'student@vibe.local' },
    };
    signInTeacher();
    const base = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (p: string, o: never) => (p === '/api/appeals/' ? { data: [appeal], error: undefined, response: new Response() } : base(p, o)));
    const user = userEvent.setup();
    renderApp(`${course}?tab=proctoring`);

    expect(await screen.findByRole('tab', { name: 'Incidents' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Removed' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Asha Student/ }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Only an admin can remove a student from the course.')).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /Remove from course/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('tab', { name: /Appeals/ }));
    expect(await screen.findByText('My webcam froze.')).toBeInTheDocument();
    expect(screen.getByText('Waiting for an admin to decide.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve and reinstate' })).not.toBeInTheDocument();
    expect(api.GET).not.toHaveBeenCalledWith('/api/ejections/history', expect.anything());
  });

  it('offers the studio from the account menu', async () => {
    signInTeacher();
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Studio' })).toBeInTheDocument();
  });
});

describe('studio for students', () => {
  it('keeps out anyone who teaches no course, and says how to get in', async () => {
    signInStudent();
    renderApp('/admin');
    expect(await screen.findByText('For course teams')).toBeInTheDocument();
    expect(screen.getByText(/invite you as an instructor or TA/)).toBeInTheDocument();
  });

  it('has no studio link in the account menu', async () => {
    signInStudent();
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    await screen.findByRole('menuitem', { name: 'Profile' });
    await waitFor(() => expect(api.GET).toHaveBeenCalledWith('/api/users/enrollments', expect.objectContaining({ params: expect.objectContaining({ query: expect.objectContaining({ role: 'TA' }) }) })));
    expect(screen.queryByRole('menuitem', { name: 'Studio' })).not.toBeInTheDocument();
  });
});
