import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession, signInStudent } from '@/test/session';

import { toAnswers, toId, type QuizQuestion } from './quiz-api';

vi.mock('@/lib/firebase', () => import('@/test/session').then((m) => m.firebaseModule));
vi.mock('firebase/auth', async (orig) => ({ ...(await orig<object>()), ...(await import('@/test/session')).firebaseAuthFns }));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const enrollment = fixtures.enrollments.enrollments[0];
const quizPath = { ...fixtures.currentPath, item: { id: 'quiz-item', name: fixtures.itemQuiz.item.name, type: 'QUIZ' } };
const url = `/learn/${enrollment.courseId}/${enrollment.courseVersionId}/${quizPath.module.id}/${quizPath.section.id}/quiz-item?track=green`;
const ITEM = '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}';
const SUBMIT = '/api/quizzes/{quizId}/attempt/{attemptId}/submit';
const CURRENT = '/api/users/progress/courses/{courseId}/versions/{versionId}/current-path';

const CORRECT = new Set(['O(1)', 'A hash map', 'Append to the end', 'Read by index']);
const ORDER = ['Hash map', 'Balanced binary search tree', 'Unsorted array'];

beforeEach(() => {
  resetSession();
  signInStudent();
  let submitted = false;
  const post = api.POST.getMockImplementation()!;
  api.POST.mockImplementation(async (p: string, ...rest: unknown[]) => {
    if (p === SUBMIT) submitted = true;
    return post(p, ...rest);
  });
  const get = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, ...rest: unknown[]) => {
    if (p === '/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent') return ok({ signed: true });
    if (p === ITEM) return ok({ item: { ...fixtures.itemQuiz.item, isAlreadyWatched: false } });
    if (p === CURRENT) return ok(submitted ? { ...quizPath, item: { id: 'after-quiz', name: 'Hash tables explained', type: 'VIDEO' } } : quizPath);
    return get(p, ...rest);
  });
});

/** Answers whatever question is showing, the way a student would (number keys for choices). */
async function answerCurrent(user: ReturnType<typeof userEvent.setup>) {
  const item = document.querySelector<HTMLElement>('[data-slot=questionnaire-item]:not([hidden])')!;
  const text = item.querySelector('legend')!.textContent ?? '';
  const choices = [...item.querySelectorAll('[data-slot=questionnaire-choice]')];
  if (choices.length) {
    for (const [i, c] of choices.entries()) {
      const label = c.querySelector('[data-slot=questionnaire-choice-label]')?.textContent?.trim() ?? '';
      if (CORRECT.has(label)) {
        item.querySelector<HTMLInputElement>('[data-slot=questionnaire-choice-input]')!.focus();
        await user.keyboard(String(i + 1));
      }
    }
  } else if (/last element/.test(text)) {
    await user.type(within(item).getByRole('spinbutton'), '7');
  } else {
    for (const [target, name] of ORDER.entries()) {
      let rows = [...item.querySelectorAll('ol li span.flex-1')].map((n) => n.textContent);
      while (rows.indexOf(name) > target) {
        await user.click(within(item).getByRole('button', { name: `Move “${name}” up` }));
        rows = [...item.querySelectorAll('ol li span.flex-1')].map((n) => n.textContent);
      }
    }
  }
  return text;
}

describe('green-track quiz', () => {
  it('shows the quiz rules before starting', async () => {
    renderApp(url);
    expect(await screen.findByRole('heading', { name: fixtures.itemQuiz.item.name })).toBeInTheDocument();
    expect(screen.getByText('Pass mark 60%')).toBeInTheDocument();
    expect(screen.getByText('Unlimited attempts')).toBeInTheDocument();
    expect(screen.getByText(/to pick an answer/)).toBeInTheDocument();
  });

  it('runs an attempt with keyboard shortcuts, submits answers in the backend’s format, and continues on pass', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(url);
    await user.click(await screen.findByRole('button', { name: 'Start quiz' }));
    const total = fixtures.quizAttempt.questionRenderViews.length;

    for (let i = 0; i < total; i++) {
      await screen.findByText(`Question ${i + 1} of ${total}`);
      await answerCurrent(user);
      if (i < total - 1) await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Submit answers' }));

    await waitFor(() => expect(api.POST).toHaveBeenCalledWith(SUBMIT, expect.anything()));
    const [, request] = api.POST.mock.calls.find(([p]) => p === SUBMIT)!;
    expect(request.params.path).toEqual({ quizId: 'quiz-item', attemptId: fixtures.quizAttempt.attemptId });
    expect(request.body).toMatchObject({ courseId: enrollment.courseId, courseVersionId: enrollment.courseVersionId, watchItemId: 'watch-1' });
    const types = request.body.answers.map((a: { questionType: string }) => a.questionType).sort();
    expect(types).toEqual(['NUMERIC_ANSWER_TYPE', 'ORDER_THE_LOTS', 'SELECT_MANY_IN_LOT', 'SELECT_ONE_IN_LOT', 'SELECT_ONE_IN_LOT']);
    for (const a of request.body.answers) expect(a.questionId).toMatch(/^[0-9a-f]{24}$/);

    expect(await screen.findByRole('heading', { name: 'Quiz passed' })).toBeInTheDocument();
    expect(screen.getByText(/You scored/)).toHaveTextContent('80%');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(router.state.location.pathname.endsWith('/after-quiz')).toBe(true));
  });

  it('offers a retry when the attempt fails', async () => {
    api.POST.mockImplementation(async (p: string) =>
      p === SUBMIT
        ? ok({ ...fixtures.quizSubmit, gradingStatus: 'FAILED', totalScore: 2 })
        : p.endsWith('/start')
          ? ok({ watchItemId: 'watch-1' })
          : ok(fixtures.quizAttempt),
    );
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('button', { name: 'Start quiz' }));
    const total = fixtures.quizAttempt.questionRenderViews.length;
    for (let i = 0; i < total; i++) {
      await screen.findByText(`Question ${i + 1} of ${total}`);
      await answerCurrent(user);
      if (i < total - 1) await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    expect(await screen.findByRole('heading', { name: 'Not passed yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry quiz/i })).toBeInTheDocument();
  });

  it('is not available in study mode', async () => {
    renderApp(url.replace('track=green', 'track=blue'));
    expect(await screen.findByText(/Assessments count only in certified mode/)).toBeInTheDocument();
    expect(api.POST.mock.calls.some(([p]) => p === '/api/quizzes/{quizId}/attempt')).toBe(false);
  });
});

describe('quiz helpers', () => {
  it('reads ObjectIds whether they arrive as strings or raw BSON buffers', () => {
    expect(toId('6ac67fb84ec7ef17228a744a')).toBe('6ac67fb84ec7ef17228a744a');
    expect(toId(fixtures.quizAttempt.questionRenderViews[0]._id)).toMatch(/^[0-9a-f]{24}$/);
  });

  it('turns questionnaire form data into the backend’s answer union', () => {
    const qs: QuizQuestion[] = [
      { id: 'a', type: 'SELECT_ONE_IN_LOT', text: '', options: [] },
      { id: 'b', type: 'SELECT_MANY_IN_LOT', text: '', options: [] },
      { id: 'c', type: 'NUMERIC_ANSWER_TYPE', text: '', options: [] },
      { id: 'd', type: 'ORDER_THE_LOTS', text: '', options: [] },
      { id: 'e', type: 'DESCRIPTIVE', text: '', options: [] },
    ];
    const form = new FormData();
    form.set('a', 'x1');
    form.append('b', 'y1');
    form.append('b', 'y2');
    form.set('c', '7');
    form.set('d:order', 'z3,z1,z2');
    form.set('e', 'because');
    expect(toAnswers(qs, form).map((a) => a.answer)).toEqual([
      { lotItemId: 'x1' },
      { lotItemIds: ['y1', 'y2'] },
      { value: 7 },
      { orders: [{ order: 1, lotItemId: 'z3' }, { order: 2, lotItemId: 'z1' }, { order: 3, lotItemId: 'z2' }] },
      { answerText: 'because' },
    ]);
  });
});
