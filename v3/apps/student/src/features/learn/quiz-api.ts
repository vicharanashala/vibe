import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@vibe/api';

import { api } from '@/lib/api';

import type { LessonRef } from './queries';

/** The backend serialises some ObjectIds as raw BSON buffers: {buffer:{data:[…12 bytes]}}. */
type RawId = string | { buffer?: { data?: number[] }; $oid?: string } | null | undefined;

export function toId(raw: RawId): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (raw.$oid) return raw.$oid;
  return (raw.buffer?.data ?? []).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type QuestionType = 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'ORDER_THE_LOTS' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  hint?: string;
  points?: number | null;
  options: { id: string; text: string }[];
}

export interface QuizDetails {
  passThreshold: number;
  maxAttempts: number;
  approximateTimeToComplete?: string;
  allowHint?: boolean;
  allowSkip?: boolean;
  showCorrectAnswersAfterSubmission?: boolean;
  showExplanationAfterSubmission?: boolean;
  showScoreAfterSubmission?: boolean;
  questionVisibility?: number;
  quizType?: 'DEADLINE' | 'NO_DEADLINE';
  deadline?: string | null;
}

export interface QuizAnswer {
  questionId: string;
  questionType: QuestionType;
  answer: { lotItemId?: string; lotItemIds?: string[]; value?: number; answerText?: string; orders?: { order: number; lotItemId: string }[] };
}

export interface QuestionFeedback {
  questionId: string;
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | string;
  score?: number | null;
  answerFeedback?: string;
}

export interface QuizResult {
  gradingStatus: 'PASSED' | 'FAILED' | 'PENDING' | string;
  totalScore?: number;
  totalMaxScore?: number;
  overallFeedback: QuestionFeedback[];
}

function fail(result: { error?: unknown; response: Response }, fallback: string): never {
  const message = (result.error as { message?: string } | undefined)?.message;
  throw new ApiError(result.response.status, message || fallback, result.error);
}

/** POST /quizzes/{quizId}/attempt — returns the attempt id and its (shuffled) questions. */
export async function createAttempt(quizId: string): Promise<{ attemptId: string; questions: QuizQuestion[] } | { noAttemptsLeft: string }> {
  const result = await api.POST('/api/quizzes/{quizId}/attempt', { params: { path: { quizId } }, body: {} as never });
  const data = result.data as
    | { attemptId?: RawId; message?: string; questionRenderViews?: { _id: RawId; type: QuestionType; text: string; hint?: string; points?: number | null; lotItems?: { _id: RawId; text: string }[] }[] }
    | undefined;
  if (!result.response.ok) fail(result, 'The quiz could not be started.');
  // The backend answers 200 with only a message when no attempts are left.
  if (data?.message && !data.attemptId) return { noAttemptsLeft: data.message };
  return {
    attemptId: toId(data?.attemptId),
    questions: (data?.questionRenderViews ?? []).map((q) => ({
      id: toId(q._id),
      type: q.type,
      text: q.text,
      hint: q.hint || undefined,
      points: q.points,
      options: (q.lotItems ?? []).map((l) => ({ id: toId(l._id), text: l.text })),
    })),
  };
}

/**
 * POST …/submit. On the green track the watch-time id and position are sent too,
 * so the backend grades the attempt and (if passed) advances progress itself.
 */
export async function submitAttempt(
  quizId: string,
  attemptId: string,
  answers: QuizAnswer[],
  context: LessonRef & { watchItemId?: string },
): Promise<QuizResult> {
  const result = await api.POST('/api/quizzes/{quizId}/attempt/{attemptId}/submit', {
    params: { path: { quizId, attemptId } },
    body: {
      answers,
      courseId: context.courseId,
      courseVersionId: context.versionId,
      moduleId: context.moduleId,
      sectionId: context.sectionId,
      watchItemId: context.watchItemId,
    } as never,
  });
  if (!result.response.ok) fail(result, 'Your answers could not be submitted.');
  const data = result.data as unknown as QuizResult & { overallFeedback?: (QuestionFeedback & { questionId: RawId })[] };
  return { ...data, overallFeedback: (data.overallFeedback ?? []).map((f) => ({ ...f, questionId: toId(f.questionId) })) };
}

/** FormData from the questionnaire → the backend's answer union. */
export function toAnswers(questions: QuizQuestion[], form: FormData): QuizAnswer[] {
  return questions.map((q) => {
    switch (q.type) {
      case 'SELECT_ONE_IN_LOT':
        return { questionId: q.id, questionType: q.type, answer: { lotItemId: String(form.get(q.id) ?? '') } };
      case 'SELECT_MANY_IN_LOT':
        return { questionId: q.id, questionType: q.type, answer: { lotItemIds: form.getAll(q.id).map(String) } };
      case 'NUMERIC_ANSWER_TYPE':
        return { questionId: q.id, questionType: q.type, answer: { value: Number(form.get(q.id)) } };
      case 'DESCRIPTIVE':
        return { questionId: q.id, questionType: q.type, answer: { answerText: String(form.get(q.id) ?? '') } };
      case 'ORDER_THE_LOTS':
        return {
          questionId: q.id,
          questionType: q.type,
          answer: {
            orders: String(form.get(`${q.id}:order`) ?? '')
              .split(',')
              .filter(Boolean)
              .map((lotItemId, i) => ({ order: i + 1, lotItemId })),
          },
        };
      default:
        return { questionId: q.id, questionType: q.type, answer: {} };
    }
  });
}

/** After a submission, refresh everything that shows progress. */
export function useAfterQuizSubmit() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['progress'] }),
      queryClient.invalidateQueries({ queryKey: ['section-items'] }),
      queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson'] }),
    ]);
}
