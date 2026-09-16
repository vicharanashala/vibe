import { ObjectId } from 'mongodb';

export type ExamGenSubject =
    | 'mathematics'
    | 'computer_science'
    | 'chemistry'
    | 'statistics'
    | 'physics'
    | 'economics'
    | 'other';

/** Target difficulty band for the whole generated set. 'mixed' (default)
 *  keeps the paper's original behavior — generate broadly, then keep the
 *  hardest `numQuestions` of the approved pool. The other three instead
 *  steer the generator toward a specific band AND change final selection to
 *  pick the closest-to-band-center approved questions rather than always
 *  the hardest — see PromptBuilder.difficultyGuidance and
 *  QuestionGenerationService.selectByDifficultyBand. */
export type ExamGenDifficultyLevel = 'easy' | 'medium' | 'hard' | 'mixed';

/**
 * One question as produced by the GENERATOR call, before the final judge
 * pass. `answer` holds the exact text of the correct option (matched against
 * `options` by string equality) rather than an index/id, since that's the
 * shape the model naturally produces and is asked for.
 */
export interface IGeneratedQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    difficulty: number; // 1-10, self-reported by the generator; re-checked by the final judge
    key_concepts: string[];
}

/** Verdict from the per-question Keep/Remove judge pass. */
export type JudgeVerdict = 'Keep' | 'Remove';

/** A just-generated-and-judged candidate, surfaced live over SSE so the
 *  admin UI can show real generated questions streaming in — not just a
 *  count — while a job runs (see QuestionGenerationService.run). */
export interface ExamGenLastQuestion {
    question: string;
    verdict: JudgeVerdict;
    difficulty: number;
}

/** Verdict from the final quality pass over the 20 collected good questions. */
export interface IFinalJudgeVerdict {
    difficulty: number;
    is_appropriate: boolean;
    answer_confirmed: boolean;
}

export type ExamGenJobStage =
    | 'generating'
    | 'final_judging'
    | 'complete'
    | 'error';

export interface ExamGenJobEvent {
    stage: ExamGenJobStage;
    good_count?: number;
    bad_count?: number;
    iteration?: number;
    question_index?: number;
    total?: number;
    message?: string;
    questions?: IGeneratedQuestion[];
    /** Which provider/model most recently answered a call — lets the admin
     *  UI show e.g. "Using: groq (openai/gpt-oss-120b)" instead of a bare
     *  progress bar with no indication anything is actually happening. */
    provider?: string;
    model?: string;
    last_question?: ExamGenLastQuestion;
}

/**
 * In-memory state for one generation run. Not persisted (see
 * QuestionGenerationService's job map + TTL sweep) — a job only needs to
 * live long enough for its SSE stream to finish and for the client to call
 * `/save` shortly after, not across server restarts.
 */
export interface IExamGenJob {
    jobId: string;
    createdBy: string;
    courseName: string;
    subject: ExamGenSubject;
    numQuestions: number;
    difficultyLevel: ExamGenDifficultyLevel;
    status: 'running' | 'complete' | 'error';
    goodQuestions: IGeneratedQuestion[];
    badQuestions: IGeneratedQuestion[];
    /** Final approved+sorted questions, populated once status === 'complete'. */
    finalQuestions: IGeneratedQuestion[];
    iteration: number;
    /** Consecutive total-provider-failure count — see QuestionGenerationService.runWithCircuitBreaker. */
    consecutiveFailures?: number;
    /** Provider/model that answered the most recent call, and the most
     *  recently generated+judged candidate — see ExamGenJobEvent. */
    lastProvider?: string;
    lastModel?: string;
    lastQuestion?: ExamGenLastQuestion;
    error?: string;
    createdAt: number;
    updatedAt: number;
}

export type SaveTarget = 'draft' | 'exam' | 'bank';

/** Mongo document for the `aiGeneratedQuestions` collection — the persisted
 *  audit record of a question once explicitly saved, wherever it went. */
export interface IGeneratedQuestionDoc {
    _id?: ObjectId | string;
    jobId: string;
    courseName: string;
    subject: ExamGenSubject;
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    difficulty: number;
    key_concepts: string[];
    target: SaveTarget;
    /** Set only when target === 'exam'. */
    examId: string | null;
    /** Set only when target === 'bank' — the QuestionBankRepository entry id. */
    bankEntryId?: string;
    createdBy: string;
    createdAt: number;
}

/** Mongo document for the `aiApiLogs` collection — one row per Anthropic call. */
export interface IAiApiLogDoc {
    _id?: ObjectId | string;
    endpoint: 'generator' | 'judge' | 'final_judge';
    model: string;
    inputTokens: number;
    outputTokens: number;
    costEstimate: number;
    createdAt: number;
}
