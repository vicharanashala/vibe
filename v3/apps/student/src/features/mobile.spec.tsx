import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

/*
 * Phone layout (Uxcel Go style). jsdom ignores media queries, so these check
 * behaviour, not which breakpoint shows what; layout is checked in the browser.
 */
const enrollment = fixtures.enrollments.enrollments[0];
const path = fixtures.currentPath;
const coursePath = `/courses/${enrollment.courseId}/${enrollment.courseVersionId}`;
const lessonUrl = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${path.module.id}/${path.section.id}/${path.item.id}`;
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('phone tab bar', () => {
  it('keeps "My courses" selected inside a course', async () => {
    renderApp(coursePath);
    const tabs = await screen.findByRole('navigation', { name: 'Tabs' });
    await waitFor(() => expect(within(tabs).getByRole('link', { name: 'My courses' })).toHaveAttribute('aria-current', 'page'));
    expect(within(tabs).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});

describe('course switcher', () => {
  it('lists the student’s courses in a bottom sheet, marking the current one', async () => {
    const user = userEvent.setup();
    renderApp(coursePath);
    await user.click(await screen.findByRole('button', { name: /switch course/i }));
    const sheet = await screen.findByRole('dialog', { name: 'Your courses' });
    expect(within(sheet).getByRole('link', { name: new RegExp(enrollment.course.name) })).toHaveAttribute('aria-current', 'page');
  });
});

describe('leaving a lesson', () => {
  beforeEach(() => {
    const get = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => (p === CONSENT ? ok({ signed: true }) : get(p, ...rest)));
  });

  it('asks before leaving an unfinished green lesson', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(lessonUrl);
    await screen.findByRole('heading', { name: fixtures.itemBlog.item.name });

    await user.click(screen.getByRole('button', { name: 'Close lesson' }));
    const sheet = await screen.findByRole('dialog', { name: 'Hold it right there!' });
    expect(sheet).toHaveTextContent('only counts once you finish it');

    await user.click(within(sheet).getByRole('button', { name: 'Keep learning' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(lessonUrl);

    await user.click(screen.getByRole('button', { name: 'Close lesson' }));
    await user.click(await screen.findByRole('button', { name: 'Leave lesson' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(coursePath));
  });

  it('closes a finished lesson straight away', async () => {
    const get = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (p: string, ...rest: unknown[]) =>
      p === '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}'
        ? ok({ ...fixtures.itemBlog, item: { ...fixtures.itemBlog.item, isAlreadyWatched: true } })
        : get(p, ...rest),
    );
    renderApp(lessonUrl);
    await screen.findByRole('heading', { name: fixtures.itemBlog.item.name });
    expect(screen.getByRole('link', { name: 'Close lesson' })).toHaveAttribute('href', coursePath);
  });
});
