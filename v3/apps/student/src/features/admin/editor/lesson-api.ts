import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { courseKeys } from '@/features/courses/queries';
import { toId } from '@/features/learn/quiz-api';
import { api } from '@/lib/api';

/**
 * Studio lesson editing. Contract notes (backend validators, unchanged):
 *  - Item create:  POST /courses/versions/{v}/modules/{m}/sections/{s}/items with
 *    videoDetails | blogDetails | quizDetails. Update: PUT /courses/{c}/versions/{v}/items/{i}
 *    with `details`, which REPLACES the stored details — so quiz updates must carry
 *    questionBankRefs back or the quiz loses its questions.
 *  - Blog `points` is validated with @IsDecimal, i.e. a string like "2.0".
 *  - Blog `content` is a string: we store sanitized-on-render HTML (the old editor did too).
 */

export type LessonType = 'VIDEO' | 'BLOG' | 'QUIZ' | 'FEEDBACK';

export interface LessonLocation {
  courseId: string;
  versionId: string;
  moduleId: string;
  sectionId: string;
}

export interface VideoDetails {
  URL: string;
  startTime: string;
  endTime: string;
  points: number;
  source?: string;
}

export interface BlogDetails {
  content: string;
  points: number;
  estimatedReadTimeInMinutes: number;
}

/** A feedback form: JSON Schema + rjsf uiSchema (see features/feedback/form-schema.ts). */
export interface FeedbackDetails {
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
}

export interface QuizDetails {
  passThreshold: number;
  maxAttempts: number;
  quizType: string;
  approximateTimeToComplete: string;
  allowPartialGrading: boolean;
  allowHint: boolean;
  allowSkip: boolean;
  showCorrectAnswersAfterSubmission: boolean;
  showExplanationAfterSubmission: boolean;
  showScoreAfterSubmission: boolean;
  questionVisibility: number;
  releaseTime: string;
  deadline?: string;
  questionBankRefs?: unknown[];
}

export const DEFAULT_QUIZ_DETAILS: QuizDetails = {
  passThreshold: 0.7,
  maxAttempts: -1,
  quizType: 'NO_DEADLINE',
  approximateTimeToComplete: '00:10:00',
  allowPartialGrading: true,
  allowHint: true,
  allowSkip: false,
  showCorrectAnswersAfterSubmission: true,
  showExplanationAfterSubmission: true,
  showScoreAfterSubmission: true,
  questionVisibility: 1,
  releaseTime: new Date(0).toISOString(),
};

const blogWire = (d: BlogDetails) => ({
  content: d.content,
  points: Number(d.points || 0).toFixed(1),
  estimatedReadTimeInMinutes: Math.max(
    1,
    Math.round(d.estimatedReadTimeInMinutes || 1),
  ),
});

export interface LessonDraft {
  name: string;
  description: string;
}

export interface LessonItem {
  _id: string;
  name: string;
  description: string;
  type: string;
  details: any;
}

/** Shared by useLesson and the outline's hover prefetch. */
export function lessonQueryOptions(loc: LessonLocation, itemId?: string) {
  return queryOptions({
    queryKey: ['studio', 'lesson', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const raw = unwrap(
        await api.GET(
          '/api/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}',
          {
            params: { path: { ...loc, itemId: itemId! } },
          },
        ),
      ) as unknown as { item: LessonItem };
      return { ...raw.item, _id: toId(raw.item._id as never) || raw.item._id };
    },
  });
}

export function useLesson(loc: LessonLocation, itemId?: string) {
  return useQuery(lessonQueryOptions(loc, itemId));
}

function invalidate(
  queryClient: ReturnType<typeof useQueryClient>,
  loc: LessonLocation,
  itemId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: courseKeys.version(loc.versionId),
  });
  void queryClient.invalidateQueries({
    queryKey: courseKeys.sectionItems(
      loc.versionId,
      loc.moduleId,
      loc.sectionId,
    ),
  });
  if (itemId)
    void queryClient.invalidateQueries({
      queryKey: ['studio', 'lesson', itemId],
    });
}

type SaveInput =
  | (LessonDraft & { type: 'VIDEO'; details: VideoDetails })
  | (LessonDraft & { type: 'BLOG'; details: BlogDetails })
  | (LessonDraft & { type: 'QUIZ'; details: QuizDetails })
  | (LessonDraft & { type: 'FEEDBACK'; details: FeedbackDetails });

/** Creates the lesson when `itemId` is missing, otherwise updates it. Resolves to the item id. */
export function useSaveLesson(loc: LessonLocation, itemId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveInput): Promise<string> => {
      if (!itemId) {
        const typed =
          input.type === 'VIDEO'
            ? {
                videoDetails: {
                  ...input.details,
                  source: input.details.source ?? 'YOUTUBE',
                },
              }
            : input.type === 'BLOG'
              ? { blogDetails: blogWire(input.details) }
              : input.type === 'FEEDBACK'
                ? { feedbackFormDetails: input.details }
                : {
                    quizDetails: (({ questionBankRefs: _refs, ...rest }) =>
                      rest)(input.details),
                  };
        const res = unwrap(
          await api.POST(
            '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items',
            {
              params: {
                path: {
                  versionId: loc.versionId,
                  moduleId: loc.moduleId,
                  sectionId: loc.sectionId,
                },
              },
              body: {
                name: input.name,
                description: input.description,
                type: input.type,
                ...typed,
              } as any,
            },
          ),
        ) as unknown as { createdItem: { _id: unknown } };
        return toId(res.createdItem._id as never);
      }
      const details =
        input.type === 'BLOG' ? blogWire(input.details) : input.details;
      unwrap(
        await api.PUT(
          '/api/courses/{courseId}/versions/{versionId}/items/{itemId}',
          {
            params: {
              path: {
                courseId: loc.courseId,
                versionId: loc.versionId,
                itemId,
              },
            },
            body: {
              name: input.name,
              description: input.description,
              type: input.type,
              details,
            } as any,
          },
        ),
      );
      return itemId;
    },
    onSuccess: (id) => invalidate(queryClient, loc, id),
  });
}

// ---------------------------------------------------------------------------
// Quiz questions
// ---------------------------------------------------------------------------

export type QuestionType =
  | 'SELECT_ONE_IN_LOT'
  | 'SELECT_MANY_IN_LOT'
  | 'ORDER_THE_LOTS'
  | 'NUMERIC_ANSWER_TYPE'
  | 'DESCRIPTIVE';

/** One answer option. `explanation` is shown after submission (backend field: `explaination`). */
export interface DraftOption {
  key: string;
  text: string;
  explanation: string;
  correct: boolean;
}

/** Editor-side question. `id` is set once it exists on the server. */
export interface DraftQuestion {
  key: string;
  id?: string;
  type: QuestionType;
  text: string;
  hint: string;
  points: number;
  timeLimitSeconds: number;
  /** SOL/SML: options with correct flags. OTL: options in the correct order. */
  options: DraftOption[];
  /** NAT */
  lowerLimit: number;
  upperLimit: number;
  decimalPrecision: number;
  /** DES */
  solutionText: string;
  /** Fields we don't edit but must send back (priority, parameters…). */
  passthrough: {
    priority: string;
    isParameterized: boolean;
    parameters: unknown[];
  };
}

let keySeq = 0;
export const newKey = () =>
  `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function blankOption(correct = false): DraftOption {
  return { key: newKey(), text: '', explanation: '', correct };
}

export function blankQuestion(
  type: QuestionType = 'SELECT_ONE_IN_LOT',
): DraftQuestion {
  return {
    key: newKey(),
    type,
    text: '',
    hint: '',
    points: 1,
    timeLimitSeconds: 60,
    options:
      type === 'NUMERIC_ANSWER_TYPE' || type === 'DESCRIPTIVE'
        ? []
        : [
            blankOption(type !== 'ORDER_THE_LOTS'),
            blankOption(),
            blankOption(),
          ],
    lowerLimit: 0,
    upperLimit: 0,
    decimalPrecision: 0,
    solutionText: '',
    passthrough: { priority: 'MEDIUM', isParameterized: false, parameters: [] },
  };
}

/** The backend rejects an empty explanation; a single space means "none". */
const NO_EXPLANATION = ' ';
type LotItem = { text: string; explaination: string };
const toLot = (o: DraftOption): LotItem => ({
  text: o.text,
  explaination: o.explanation.trim() ? o.explanation : NO_EXPLANATION,
});
const fromLot = (
  l: { text: string; explaination?: string },
  correct: boolean,
): DraftOption => ({
  key: newKey(),
  text: l.text ?? '',
  explanation: (l.explaination ?? '').trim(),
  correct,
});

export function toWire(q: DraftQuestion) {
  const question = {
    text: q.text,
    type: q.type,
    isParameterized: q.passthrough.isParameterized,
    parameters: q.passthrough.parameters,
    hint: q.hint,
    timeLimitSeconds: q.timeLimitSeconds,
    points: q.points,
    priority: q.passthrough.priority,
  };
  let solution: Record<string, unknown>;
  switch (q.type) {
    case 'SELECT_ONE_IN_LOT': {
      const correct = q.options.find((o) => o.correct) ?? q.options[0];
      solution = {
        correctLotItem: toLot(correct),
        incorrectLotItems: q.options.filter((o) => o !== correct).map(toLot),
      };
      break;
    }
    case 'SELECT_MANY_IN_LOT':
      solution = {
        correctLotItems: q.options.filter((o) => o.correct).map(toLot),
        incorrectLotItems: q.options.filter((o) => !o.correct).map(toLot),
      };
      break;
    case 'ORDER_THE_LOTS':
      solution = {
        ordering: q.options.map((o, i) => ({
          lotItem: toLot(o),
          order: i + 1,
        })),
      };
      break;
    case 'NUMERIC_ANSWER_TYPE':
      solution = {
        lowerLimit: q.lowerLimit,
        upperLimit: q.upperLimit,
        decimalPrecision: q.decimalPrecision,
      };
      break;
    case 'DESCRIPTIVE':
      solution = { solutionText: q.solutionText };
      break;
  }
  return { question, solution };
}

export function fromWire(raw: any): DraftQuestion {
  const type = raw.type as QuestionType;
  let options: DraftOption[] = [];
  if (type === 'SELECT_ONE_IN_LOT')
    options = [
      fromLot(raw.correctLotItem, true),
      ...(raw.incorrectLotItems ?? []).map((l: LotItem) => fromLot(l, false)),
    ];
  if (type === 'SELECT_MANY_IN_LOT')
    options = [
      ...(raw.correctLotItems ?? []).map((l: LotItem) => fromLot(l, true)),
      ...(raw.incorrectLotItems ?? []).map((l: LotItem) => fromLot(l, false)),
    ];
  if (type === 'ORDER_THE_LOTS')
    options = [...(raw.ordering ?? [])]
      .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
      .map((o: { lotItem: LotItem }) => fromLot(o.lotItem, false));
  return {
    key: newKey(),
    id: toId(raw._id),
    type,
    text: raw.text ?? '',
    hint: raw.hint ?? '',
    points: raw.points ?? 1,
    timeLimitSeconds: raw.timeLimitSeconds ?? 60,
    options,
    lowerLimit: raw.lowerLimit ?? 0,
    upperLimit: raw.upperLimit ?? 0,
    decimalPrecision: raw.decimalPrecision ?? 0,
    solutionText: raw.solutionText ?? '',
    passthrough: {
      priority: raw.priority ?? 'MEDIUM',
      isParameterized: !!raw.isParameterized,
      parameters: raw.parameters ?? [],
    },
  };
}

interface BankRef {
  bankId: string;
  count: number;
  title?: string;
}

/** Loads a quiz's own bank (the first one attached) and its questions. */
export function quizQuestionsQueryOptions(quizId?: string) {
  return queryOptions({
    queryKey: ['studio', 'quiz-questions', quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const banks =
        (unwrap(
          await api.GET('/api/quizzes/quiz/{quizId}/bank', {
            params: { path: { quizId: quizId! } },
          }),
        ) as unknown as any[]) ?? [];
      const own = banks
        .map(
          (b) =>
            ({
              bankId: toId(b.bankId),
              count: b.count,
              title: b.title,
            }) as BankRef,
        )
        .find((b) => b.bankId && b.title !== 'To Be Verified');
      if (!own)
        return {
          bank: null as BankRef | null,
          questions: [] as DraftQuestion[],
        };
      const bank = unwrap(
        await api.GET('/api/quizzes/question-bank/{questionBankId}', {
          params: { path: { questionBankId: own.bankId } },
        }),
      ) as unknown as { questions: unknown[] };
      const questions = await Promise.all(
        (bank.questions ?? []).map(async (qid) => {
          const raw = unwrap(
            await api.GET('/api/quizzes/questions/{questionId}', {
              params: { path: { questionId: toId(qid as never) } },
            }),
          );
          return fromWire(raw);
        }),
      );
      return { bank: own, questions };
    },
  });
}

export function useQuizQuestions(quizId?: string) {
  return useQuery(quizQuestionsQueryOptions(quizId));
}

/**
 * Brings the server in line with the editor: creates the quiz's bank if needed,
 * creates/updates questions, removes deleted ones, and keeps "all questions per
 * attempt" in sync with the question count.
 */
export async function syncQuizQuestions({
  quizId,
  loc,
  quizName,
  bank,
  before,
  after,
  questionsPerAttempt,
}: {
  quizId: string;
  loc: LessonLocation;
  quizName: string;
  bank: BankRef | null;
  before: DraftQuestion[];
  after: DraftQuestion[];
  /** null = every question in every attempt */
  questionsPerAttempt: number | null;
}): Promise<DraftQuestion[]> {
  let bankId = bank?.bankId;
  if (!bankId) {
    const created = unwrap(
      await api.POST('/api/quizzes/question-bank/', {
        body: {
          title: `${quizName} — questions`,
          description: `Questions for the quiz “${quizName}”.`,
          courseId: loc.courseId,
          courseVersionId: loc.versionId,
        } as any,
      }),
    ) as unknown as { questionBankId: string };
    bankId = toId(created.questionBankId as never);
    unwrap(
      await api.POST('/api/quizzes/quiz/{quizId}/bank', {
        params: { path: { quizId } },
        body: { bankId, count: Math.max(1, after.length) } as any,
      }),
    );
  }

  const saved: DraftQuestion[] = [];
  for (const q of after) {
    if (q.id) {
      const prev = before.find((b) => b.id === q.id);
      if (!prev || JSON.stringify(toWire(prev)) !== JSON.stringify(toWire(q))) {
        unwrap(
          await api.PUT('/api/quizzes/questions/{questionId}', {
            params: { path: { questionId: q.id } },
            body: toWire(q) as any,
          }),
        );
      }
      saved.push(q);
    } else {
      const res = unwrap(
        await api.POST('/api/quizzes/questions/', { body: toWire(q) as any }),
      ) as unknown as { questionId: string };
      const id = toId(res.questionId as never);
      unwrap(
        await api.PATCH(
          '/api/quizzes/question-bank/{questionBankId}/questions/{questionId}/add',
          { params: { path: { questionBankId: bankId, questionId: id } } },
        ),
      );
      saved.push({ ...q, id });
    }
  }
  for (const gone of before.filter(
    (b) => b.id && !after.some((a) => a.id === b.id),
  )) {
    unwrap(
      await api.PATCH(
        '/api/quizzes/question-bank/{questionBankId}/questions/{questionId}/remove',
        { params: { path: { questionBankId: bankId, questionId: gone.id! } } },
      ),
    );
  }

  const count = Math.max(
    1,
    questionsPerAttempt === null
      ? after.length
      : Math.min(questionsPerAttempt, after.length),
  );
  if (!bank || bank.count !== count) {
    unwrap(
      await api.PATCH('/api/quizzes/quiz/{quizId}/bank', {
        params: { path: { quizId } },
        body: { bankId, count } as any,
      }),
    );
  }
  return saved;
}

// ---------------------------------------------------------------------------
// Feedback responses
// ---------------------------------------------------------------------------

export interface FeedbackResponse {
  _id: string;
  createdAt: string;
  details: Record<string, unknown>;
  user: { _id: string; firstName?: string; lastName?: string; email?: string };
  previousItem?: { name?: string } | null;
}

/** GET /courses/{courseId}/item/{feedbackId}/feedback/submissions — choice values come back as their labels. */
export function useFeedbackResponses(
  courseId: string,
  feedbackId: string | undefined,
  page: number,
  search: string,
) {
  return useQuery({
    queryKey: ['studio', 'feedback-responses', feedbackId, page, search],
    enabled: !!feedbackId,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const raw = unwrap(
        await api.GET(
          '/api/courses/{courseId}/item/{feedbackId}/feedback/submissions',
          {
            params: {
              path: { courseId, feedbackId: feedbackId! },
              query: { page: String(page), limit: '20', search },
            },
          },
        ),
      ) as unknown as { submissions: any[]; total: number; totalPages: number };
      return {
        total: raw.total ?? 0,
        totalPages: raw.totalPages ?? 1,
        responses: (raw.submissions ?? []).map((s): FeedbackResponse => ({
          _id: toId(s._id),
          createdAt: s.createdAt,
          details: s.details ?? {},
          user: {
            _id: toId(s.user?._id),
            firstName: s.user?.firstName,
            lastName: s.user?.lastName,
            email: s.user?.email,
          },
          previousItem: s.previousItem ? { name: s.previousItem.name } : null,
        })),
      };
    },
  });
}

/** Downloads the backend's CSV export (it needs the auth header, so it can't be a plain link). */
export async function downloadFeedbackCsv(
  courseId: string,
  feedbackId: string,
  filename: string,
) {
  const { data, error } = await api.GET(
    '/api/courses/{courseId}/item/{feedbackId}/feedback/submissions/export',
    {
      params: { path: { courseId, feedbackId } },
      parseAs: 'blob',
    },
  );
  if (error || !data)
    throw new Error('Couldn’t export the responses. Please try again.');
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Every response (up to 1000) for the Summary view's counts and averages. The
 * submissions endpoint is paged; one large page keeps this to a single request.
 */
export function useFeedbackSummary(
  courseId: string,
  feedbackId: string | undefined,
) {
  return useQuery({
    queryKey: ['studio', 'feedback-summary', feedbackId],
    enabled: !!feedbackId,
    queryFn: async () => {
      const raw = unwrap(
        await api.GET(
          '/api/courses/{courseId}/item/{feedbackId}/feedback/submissions',
          {
            params: {
              path: { courseId, feedbackId: feedbackId! },
              query: { page: '1', limit: '1000', search: '' },
            },
          },
        ),
      ) as unknown as {
        submissions: { details?: Record<string, unknown>; createdAt: string }[];
        total: number;
      };
      return {
        total: raw.total ?? 0,
        rows: (raw.submissions ?? []).map((s) => ({
          details: s.details ?? {},
          createdAt: s.createdAt,
        })),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Quiz results
// ---------------------------------------------------------------------------

export interface QuizAnalytics {
  totalAttempts: number;
  submissions: number;
  passRate: number;
  averageScore: number;
  averagePercentage: number;
}

export interface QuizQuestionPerformance {
  questionId: string;
  correctRate: number;
  averageScore: number;
}

export interface QuizAttemptResult {
  id: string;
  attemptId: string;
  userId: string;
  submittedAt: string;
  status: 'PASSED' | 'FAILED' | 'PENDING' | string;
  score: number;
  maxScore: number;
  user: { firstName?: string; lastName?: string; email?: string };
  questions: {
    questionId: string;
    status: string;
    score: number;
    feedback?: string;
  }[];
}

/** GET /quizzes/quiz/{id}/analytics and /performance: headline numbers and per-question correct rates. */
export function useQuizAnalytics(quizId: string | undefined) {
  return useQuery({
    queryKey: ['studio', 'quiz-analytics', quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const [analytics, performance] = await Promise.all([
        api
          .GET('/api/quizzes/quiz/{quizId}/analytics', {
            params: { path: { quizId: quizId! } },
          })
          .then(unwrap),
        api
          .GET('/api/quizzes/quiz/{quizId}/performance', {
            params: { path: { quizId: quizId! } },
          })
          .then(unwrap),
      ]);
      return {
        analytics: analytics as unknown as QuizAnalytics,
        performance: (
          (performance as unknown as QuizQuestionPerformance[]) ?? []
        ).map((p) => ({ ...p, questionId: toId(p.questionId as never) })),
      };
    },
  });
}

function toAttempt(s: any): QuizAttemptResult {
  const g = s.gradingResult ?? {};
  return {
    id: toId(s._id),
    attemptId: toId(s.attemptId),
    userId: toId(s.userId),
    submittedAt: s.submittedAt,
    status: g.gradingStatus ?? 'PENDING',
    score: g.totalScore ?? 0,
    maxScore: g.totalMaxScore ?? 0,
    // The backend sends the whole user document; only these fields are used.
    user: {
      firstName: s.userInfo?.firstName,
      lastName: s.userInfo?.lastName,
      email: s.userInfo?.email,
    },
    questions: (g.overallFeedback ?? []).map((q: any) => ({
      questionId: toId(q.questionId),
      status: q.status,
      score: q.score ?? 0,
      feedback: q.answerFeedback,
    })),
  };
}

export type AttemptSort = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc';

/** GET /quizzes/quiz/{id}/submissions: one row per submitted attempt, paged, with status filter, search and sort. */
export function useQuizAttempts(
  quizId: string | undefined,
  opts: {
    page: number;
    limit: number;
    status?: 'PASSED' | 'FAILED' | 'PENDING';
    search?: string;
    sort?: AttemptSort;
  },
) {
  return useQuery({
    queryKey: ['studio', 'quiz-attempts', quizId, opts],
    enabled: !!quizId,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const raw = unwrap(
        await api.GET('/api/quizzes/quiz/{quizId}/submissions', {
          params: {
            path: { quizId: quizId! },
            query: {
              currentPage: opts.page,
              limit: opts.limit,
              sort: opts.sort ?? 'date_desc',
              ...(opts.status ? { gradeStatus: opts.status } : {}),
              ...(opts.search ? { search: opts.search } : {}),
            } as never,
          },
        }),
      ) as unknown as { data: any[]; totalCount: number; totalPages: number };
      return {
        total: raw.totalCount ?? 0,
        totalPages: raw.totalPages ?? 1,
        attempts: (raw.data ?? []).map(toAttempt),
      };
    },
  });
}

/** POST /quizzes/quiz/{id}/user/{userId}/reset-attempts: gives a student their full attempt allowance again. */
export function useResetQuizAttempts(quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await api.POST(
          '/api/quizzes/quiz/{quizId}/user/{userId}/reset-attempts',
          { params: { path: { quizId, userId } } },
        ),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['studio', 'quiz-attempts', quizId],
      }),
  });
}
