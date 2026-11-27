import { screen, waitFor, within } from '@testing-library/react';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { hiddenInStudyMode, itemsForTrack } from './study-mode';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const [firstModule, secondModule] = fixtures.courseVersion.modules;
const firstSection = firstModule.sections[0];
const secondSection = secondModule.sections[0];
const CONSENT = '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent';
const VERSION = '/api/courses/versions/{versionId}';
const SECTION_ITEMS = '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items';
const CURRENT_PATH = '/api/users/progress/courses/{courseId}/versions/{versionId}/current-path';
const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';

const reading = { _id: 'item-reading', type: 'BLOG', order: '0|a', isHidden: null, name: 'How this course works', isCompleted: false };
const quiz = { _id: 'item-quiz', type: 'QUIZ', order: '0|b', isHidden: null, name: 'Check your understanding', isCompleted: false };
const video = { _id: 'item-video', type: 'VIDEO', order: '0|c', isHidden: null, name: 'Arrays in practice', isCompleted: false };
const quizOnly = { _id: 'item-quiz-2', type: 'QUIZ', order: '0|a', isHidden: null, name: 'Module 2 test', isCompleted: false };

/** One module with a reading, a quiz and a video; a second module with only a quiz. */
function course(currentItem: { id: string; name: string; type: string }) {
  const version = { ...fixtures.courseVersion, totalItems: 4, itemCounts: { BLOG: 1, VIDEO: 1, QUIZ: 2 } };
  const fallback = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, opts?: { params?: { path?: Record<string, string> } }, ...rest: unknown[]) => {
    if (p === CONSENT) return ok({ signed: true });
    if (p === VERSION) return ok(version);
    if (p === SECTION_ITEMS) return ok(opts?.params?.path?.sectionId === secondSection.sectionId ? [quizOnly] : [reading, quiz, video]);
    if (p === CURRENT_PATH)
      return ok({
        module: { id: firstModule.moduleId, name: firstModule.name },
        section: { id: firstSection.sectionId, name: firstSection.name },
        item: currentItem,
      });
    return fallback(p, opts, ...rest);
  });
}

const coursePage = `/courses/${enrollment.courseId}/${enrollment.courseVersionId}`;
const lessonUrl = (itemId: string, track: 'blue' | 'green') =>
  `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${firstModule.moduleId}/${firstSection.sectionId}/${itemId}?track=${track}`;

beforeEach(() => {
  resetSession();
  signInStudent();
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
});

describe('quizzes in study mode', () => {
  it('hides quizzes, and modules with only quizzes, from the study syllabus', async () => {
    course({ id: reading._id, name: reading.name, type: 'BLOG' });
    localStorage.setItem(`vibe:track:${enrollment.courseVersionId}`, 'blue');
    renderApp(coursePage);
    const syllabus = await screen.findByRole('region', { name: 'Syllabus' }).catch(() => screen.findByText('Syllabus').then((h) => h.closest('section')!));
    await waitFor(() => expect(within(syllabus).getByText(reading.name)).toBeInTheDocument());
    expect(within(syllabus).getByText(video.name)).toBeInTheDocument();
    expect(within(syllabus).queryByText(quiz.name)).not.toBeInTheDocument();
    await waitFor(() => expect(within(syllabus).queryByText(secondModule.name)).not.toBeInTheDocument());
    expect(within(syllabus).getByText('1 modules · 2 lessons')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ quiz/)).not.toBeInTheDocument();
  });

  it('still shows quizzes in strict mode', async () => {
    course({ id: reading._id, name: reading.name, type: 'BLOG' });
    localStorage.setItem(`vibe:track:${enrollment.courseVersionId}`, 'green');
    renderApp(coursePage);
    expect(await screen.findByText(quiz.name)).toBeInTheDocument();
    expect(screen.getByText(secondModule.name)).toBeInTheDocument();
    expect(screen.getByText('2 modules · 4 lessons')).toBeInTheDocument();
  });

  it('continues with the next lesson instead of a quiz in study mode', async () => {
    course({ id: quiz._id, name: quiz.name, type: 'QUIZ' });
    localStorage.setItem(`vibe:track:${enrollment.courseVersionId}`, 'blue');
    renderApp(coursePage);
    const links = await screen.findAllByRole('link', { name: /Study where you left off/ });
    await waitFor(() => expect(links[0].getAttribute('href')).toContain(`/${video._id}?track=blue`));
  });

  it('skips quizzes with Previous/Next in study mode', async () => {
    course({ id: reading._id, name: reading.name, type: 'BLOG' });
    renderApp(lessonUrl(reading._id, 'blue'));
    const next = await screen.findByRole('link', { name: /next/i });
    await waitFor(() => expect(next.getAttribute('href')).toContain(`/${video._id}?track=blue`));
  });

  it('a direct link to a quiz in study mode says to take it in strict mode', async () => {
    course({ id: quiz._id, name: quiz.name, type: 'QUIZ' });
    const fallback = api.GET.getMockImplementation()!;
    api.GET.mockImplementation(async (p: string, ...rest: unknown[]) =>
      p === ITEM ? ok({ item: { ...fixtures.itemQuiz.item, _id: quiz._id, type: 'QUIZ' } }) : fallback(p, ...rest),
    );
    renderApp(lessonUrl(quiz._id, 'blue'));
    const heading = await screen.findByRole('heading', { name: 'Quizzes are taken in strict mode' });
    const notice = heading.closest('main') ?? document.body;
    const action = within(notice as HTMLElement).getAllByRole('link', { name: 'Switch to strict mode' })[0];
    expect(action.getAttribute('href')).toContain(`/${quiz._id}?track=green`);
  });
});

describe('itemsForTrack', () => {
  it('drops only quizzes, and only in study mode', () => {
    const items = [reading, quiz, video];
    expect(itemsForTrack(items, 'blue')).toEqual([reading, video]);
    expect(itemsForTrack(items, 'green')).toEqual(items);
    expect(hiddenInStudyMode({ type: 'FEEDBACK' })).toBe(false);
  });
});
