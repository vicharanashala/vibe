import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { signInAdmin, studio, studioGet } from '@/test/studio';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const [template] = studio.courses.courses;

/** `count` courses shaped like the captured record, created one day apart, newest first. */
function makeCourses(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...template,
    _id: Math.floor((NOW - i * DAY) / 1000).toString(16).padStart(8, '0') + i.toString(16).padStart(16, '0'),
    name: `Course ${String(i).padStart(2, '0')}`,
    description: i === 7 ? 'Graph algorithms and shortest paths' : 'A course',
    // Some records have no createdAt; their ObjectId time is used instead.
    createdAt: i % 2 ? undefined : new Date(NOW - i * DAY).toISOString(),
  }));
}

beforeEach(() => {
  resetSession();
  signInAdmin();
  const courses = makeCourses(45);
  api.GET.mockImplementation(async (path: string, opts?: never) => (path === '/api/courses/' ? ok({ courses }) : studioGet(path, opts)));
});

const courseLinks = () => screen.getAllByRole('link', { name: /^Course \d+/ });

describe('Courses page', () => {
  it('shows 20 courses a page, newest first, and pages through the rest', async () => {
    const user = userEvent.setup();
    renderApp('/admin/courses');
    expect(await screen.findByText('1–20 of 45')).toBeInTheDocument();
    expect(courseLinks()).toHaveLength(20);
    expect(courseLinks()[0]).toHaveTextContent('Course 00');

    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('41–45 of 45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });

  it('sorts oldest first and filters by when courses were created', async () => {
    const user = userEvent.setup();
    renderApp('/admin/courses');
    await screen.findByText('1–20 of 45');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'oldest');
    expect(courseLinks()[0]).toHaveTextContent('Course 44');

    // Created 0..6 days ago (with or without createdAt) fall inside "last 7 days".
    await user.selectOptions(screen.getByRole('combobox', { name: 'Created' }), '7');
    expect(screen.getByText('1–7 of 7')).toBeInTheDocument();
  });

  it('searches names and descriptions', async () => {
    const user = userEvent.setup();
    renderApp('/admin/courses');
    await screen.findByText('1–20 of 45');
    await user.type(screen.getByRole('textbox', { name: 'Search courses' }), 'shortest');
    expect(await screen.findByText('1–1 of 1')).toBeInTheDocument();
    expect(courseLinks()[0]).toHaveTextContent('Course 07');
  });
});
