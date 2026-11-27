import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, resetSession, signInStudent } from '@/test/session';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const STUDY = '/api/users/progress/courses/{courseId}/versions/{versionId}/study-progress';
const coursePage = `/courses/${enrollment.courseId}/${enrollment.courseVersionId}`;

beforeEach(() => {
  resetSession();
  signInStudent();
});

describe('study progress', () => {
  it('shows study progress on the course page next to strict progress', async () => {
    renderApp(coursePage);
    const { studiedItems, totalItems, percentStudied } = fixtures.studyProgress;
    const lines = await screen.findAllByText(new RegExp(`${studiedItems} of ${totalItems} videos & articles`));
    expect(lines.length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${percentStudied}%`).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('progressbar', { name: 'Study progress' }).length).toBeGreaterThan(0);
    // Strict progress is still the course's progress.
    expect(screen.getAllByRole('progressbar', { name: 'Course progress' }).length).toBeGreaterThan(0);
  });

  it('marks studied lessons in the study-mode outline', async () => {
    const user = userEvent.setup();
    renderApp(coursePage);
    const switcher = await screen.findByRole('tablist', { name: 'Mode' });
    await user.click(within(switcher).getByRole('tab', { name: 'Study mode' }));
    const video = fixtures.sectionItems.find((i) => i.type === 'VIDEO')!;
    expect(fixtures.studyProgress.studiedItemIds).toContain(video._id);
    const row = await screen.findByRole('link', { name: new RegExp(video.name) });
    expect(within(row).getByText('Studied')).toBeInTheDocument();
  });

  it('shows the study percentage on course cards', async () => {
    renderApp('/courses');
    const bar = await screen.findByRole('progressbar', { name: 'Study progress' });
    const meter = bar.parentElement!;
    expect(within(meter).getByText('Study')).toBeInTheDocument();
    expect(within(meter).getByText(`${fixtures.studyProgress.percentStudied}%`)).toBeInTheDocument();
  });

  it('hides the study line when study progress can’t be loaded', async () => {
    const fallback = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => {
      if (p === STUDY) return { data: undefined, error: { message: 'Not found' }, response: new Response(null, { status: 404 }) };
      return fallback(p, ...rest);
    });
    renderApp(coursePage);
    expect((await screen.findAllByRole('progressbar', { name: 'Course progress' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('progressbar', { name: 'Study progress' })).not.toBeInTheDocument();
    expect(screen.queryByText(/videos & articles/)).not.toBeInTheDocument();
  });
});
