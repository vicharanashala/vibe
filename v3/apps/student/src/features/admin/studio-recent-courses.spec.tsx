import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, ok, resetSession } from '@/test/session';
import { ADMIN, FEEDBACK, hex, SAMPLE, signInAdmin, signInTeacher, studio, studioGet, TEACHER } from '@/test/studio';

import { readRecentCourses, recordCourseVisit } from './recent-courses';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const recentIds = () => readRecentCourses(ADMIN.uid).map((e) => e.courseId);
const coursePage = (c: { courseId: string; versionId: string }, tab = '') =>
  `/admin/courses/${c.courseId}/${c.versionId}${tab ? `?tab=${tab}` : ''}`;

beforeEach(() => {
  resetSession();
  localStorage.clear();
  signInAdmin();
});

describe('recording opened courses', () => {
  it('puts a course first when its page opens', async () => {
    recordCourseVisit(ADMIN.uid, FEEDBACK.courseId, FEEDBACK.versionId);
    renderApp(coursePage(SAMPLE));
    await waitFor(() => expect(recentIds()).toEqual([SAMPLE.courseId, FEEDBACK.courseId]));
    expect(readRecentCourses(ADMIN.uid)[0].versionId).toBe(SAMPLE.versionId);
  });

  it('puts a course first when one of its lesson editors opens', async () => {
    recordCourseVisit(ADMIN.uid, SAMPLE.courseId, SAMPLE.versionId);
    renderApp(
      `/admin/courses/${FEEDBACK.courseId}/${FEEDBACK.versionId}/lesson?module=${FEEDBACK.moduleId}&section=${FEEDBACK.sectionId}&item=${FEEDBACK.itemId}`,
    );
    await waitFor(() => expect(recentIds()).toEqual([FEEDBACK.courseId, SAMPLE.courseId]));
  });

  it('does not re-record when switching tabs within a course', async () => {
    const user = userEvent.setup();
    renderApp(coursePage(SAMPLE));
    await waitFor(() => expect(recentIds()).toEqual([SAMPLE.courseId]));
    const first = readRecentCourses(ADMIN.uid)[0].at;
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await user.click(await screen.findByRole('tab', { name: 'People' }));
    await user.click(screen.getByRole('tab', { name: 'Content' }));

    expect(setItem.mock.calls.filter(([key]) => String(key).startsWith('studio:recent-courses:'))).toHaveLength(0);
    expect(readRecentCourses(ADMIN.uid)[0].at).toBe(first);
  });
});

/** The captured studio courses, as the sidebar sees them. */
const courses = studio.courses.courses.map((c) => ({ id: hex(c._id), versionId: hex(c.versions[0]), name: c.name, createdAt: c.createdAt }));
const named = (name: string) => courses.find((c) => c.name === name)!;
const recentList = async () => within(await screen.findByRole('list', { name: 'Recent courses' }));
// The name text, without the cover art's decorative initials (which assistive tech skips too).
const recentNames = async () => (await recentList()).getAllByRole('link').map((a) => a.lastElementChild?.textContent);

describe('recent courses in the studio sidebar', () => {
  it('lists recently opened courses under Courses, newest first', async () => {
    for (const name of ['Studio quiz test', 'Sample: Introduction to Algorithms', 'Studio editor test']) {
      const c = named(name);
      recordCourseVisit(ADMIN.uid, c.id, c.versionId);
    }
    renderApp('/admin');
    expect(await recentNames()).toEqual(['Studio editor test', 'Sample: Introduction to Algorithms', 'Studio quiz test']);
  });

  it('shows at most 5, dropping the oldest', async () => {
    // Seven distinct courses shaped like the captured ones.
    const [template] = studio.courses.courses;
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...template,
      _id: `6ad0000000000000000000${String(i).padStart(2, '0')}`,
      versions: [`6ad1000000000000000000${String(i).padStart(2, '0')}`],
      name: `Course ${i}`,
    }));
    api.GET.mockImplementation(async (path: string, opts?: never) => (path === '/api/courses/' ? ok({ courses: many }) : studioGet(path, opts)));
    for (const c of many) recordCourseVisit(ADMIN.uid, c._id, c.versions[0]);
    renderApp('/admin');
    expect(await recentNames()).toEqual(['Course 6', 'Course 5', 'Course 4', 'Course 3', 'Course 2']);
  });

  it('shows the newest courses before any course has been opened', async () => {
    renderApp('/admin');
    const newest = [...courses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((c) => c.name);
    expect(await recentNames()).toEqual(newest);
  });

  it('skips courses that are no longer in the user’s course list', async () => {
    const quiz = named('Studio quiz test');
    recordCourseVisit(ADMIN.uid, quiz.id, quiz.versionId);
    recordCourseVisit(ADMIN.uid, '0123456789abcdef01234567', '0123456789abcdef01234568');
    renderApp('/admin');
    expect(await recentNames()).toEqual(['Studio quiz test']);
  });

  it('shows a non-admin teacher only the courses they teach', async () => {
    signInTeacher();
    recordCourseVisit(TEACHER.uid, SAMPLE.courseId, SAMPLE.versionId);
    recordCourseVisit(TEACHER.uid, FEEDBACK.courseId, FEEDBACK.versionId);
    renderApp('/admin');
    expect(await recentNames()).toEqual(['Studio feedback test']);
  });

  it('marks the open course and opens a course when selected', async () => {
    const user = userEvent.setup();
    const quiz = named('Studio quiz test');
    recordCourseVisit(ADMIN.uid, quiz.id, quiz.versionId);
    const { router } = renderApp(coursePage(SAMPLE));

    const current = await (await recentList()).findByRole('link', { name: 'Sample: Foundations of Data Structures' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect((await recentList()).getByRole('link', { name: 'Studio quiz test' })).not.toHaveAttribute('aria-current');

    await user.click((await recentList()).getByRole('link', { name: 'Studio quiz test' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/courses/${quiz.id}/${quiz.versionId}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Studio quiz test' })).toBeInTheDocument();
  });
});
