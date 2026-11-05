import { screen, within } from '@testing-library/react';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { SAMPLE, signInAdmin, studio, studioGet } from '@/test/studio';

import { normalizeCourseRole, normalizeGlobalRole } from './queries';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

// Production data: `roles` is a string for some accounts and an array for others,
// and course roles can be lowercase or missing. The studio crashed on these
// ("e.toUpperCase is not a function").
const [first, second, ...rest] = studio.users.users;
const mixedUsers = { users: [{ ...first, roles: ['admin'] }, { ...second, roles: null }, ...rest] };
const [enrolled, ...others] = studio.enrollments.enrollments;
const mixedEnrollments = { ...studio.enrollments, enrollments: [{ ...enrolled, role: null }, ...others.map((e) => ({ ...e, role: String(e.role).toLowerCase() }))] };

function serveMixedData(me: unknown = undefined) {
  api.GET.mockImplementation(async (path: string, opts?: never) => {
    if (path === '/api/users/') return ok(mixedUsers);
    if (path === '/api/users/enrollments/courses/{courseId}/versions/{versionId}') return ok(mixedEnrollments);
    if (path === '/api/users/me' && me) return ok(me);
    return studioGet(path, opts);
  });
}

beforeEach(() => {
  resetSession();
  signInAdmin();
});

describe('role shapes from production', () => {
  it('normalises roles the way the backend does', () => {
    expect(normalizeGlobalRole(['admin'])).toBe('admin');
    expect(normalizeGlobalRole(['user', 'ADMIN'])).toBe('admin');
    expect(normalizeGlobalRole('admin')).toBe('admin');
    expect(normalizeGlobalRole(null)).toBe('user');
    expect(normalizeCourseRole('instructor')).toBe('INSTRUCTOR');
    expect(normalizeCourseRole(null)).toBe('STUDENT');
  });

  it('opens studio Home when users have array or missing roles', async () => {
    serveMixedData();
    renderApp('/admin');
    const people = (await screen.findByRole('heading', { name: 'Newest people' })).parentElement!.parentElement!;
    expect(await within(people).findByText(first.email)).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });

  it('lets in an admin whose own role is stored as an array', async () => {
    serveMixedData({ ...studio.userMeAdmin, roles: ['admin'] });
    renderApp('/admin/users');
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.queryByText('For course teams')).not.toBeInTheDocument();
  });

  it('shows the People tab when course roles are lowercase or missing', async () => {
    serveMixedData();
    renderApp(`/admin/courses/${SAMPLE.courseId}/${SAMPLE.versionId}?tab=people`);
    expect(await screen.findByRole('tab', { name: /Students/ })).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });
});
