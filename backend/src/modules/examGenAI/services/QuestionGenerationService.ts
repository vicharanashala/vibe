import { injectable, inject } from 'inversify';
import { randomUUID } from 'crypto';
import { NotFoundError, ForbiddenError } from 'routing-controllers';
import { examGenAIConfig, ExamGenAIProvider } from '#root/config/examGenAI.js';
import { EXAM_GENAI_TYPES } from '../types.js';
import { LlmClient, LlmClientError } from './LlmClient.js';
import { SseService } from './SseService.js';
import { GeneratedQuestionRepository } from '../repositories/providers/mongodb/GeneratedQuestionRepository.js';
import { buildGeneratorPrompt, buildJudgePrompt, buildFinalJudgePrompt, CourseMaterials } from './PromptBuilder.js';
import {
    IExamGenJob,
    IGeneratedQuestion,
    JudgeVerdict,
    IFinalJudgeVerdict,
    ExamGenSubject,
    ExamGenDifficultyLevel,
} from '../classes/transformers/ExamGenAI.js';
import { GenerateQuestionsBody } from '../classes/validators/ExamGenAIValidators.js';

/**
 * Collapses whitespace runs (regular spaces, tabs, and Unicode space
 * variants) to a single space in every string field of a just-parsed
 * generator response, before validation. Models occasionally emit runs of
 * multiple spaces between words (observed on MiniMax-M3 — looks like an
 * attempt at letter/word-spaced emphasis in plain text). That's invisible
 * anywhere the text is displayed inside normal HTML flow (browsers collapse
 * whitespace by default), but shows up as ugly gaps anywhere it isn't —
 * notably the PDF response-sheet export, which draws raw glyph runs with no
 * whitespace collapsing of its own (see ResultPage.jsx's
 * sanitizeForPdfText). Fixing it here, once, at generation time means every
 * downstream consumer (PDF export, CSV/JSON export, the question bank, the
 * exam-taking UI) gets clean text — not just whichever one someone noticed
 * it in first.
 */
const WHITESPACE_RUN_RE = new RegExp('[ \\t\\u00A0\\u2000-\\u200B\\u202F\\u3000]+', 'g');
function collapseWhitespace(s: string): string {
    return s.replace(WHITESPACE_RUN_RE, ' ').trim();
}

/**
 * Despite the generator prompt now explicitly forbidding it (see
 * PromptBuilder's GENERATOR_RULES), the model sometimes bakes its own
 * "A)"/"B."/"1)" label into an option's own text, on top of the letter every
 * downstream UI already prepends from the option's position — producing a
 * visible "A. A) ..." double-label (also defensively stripped at display
 * time in ResultPage.jsx/QuestionRenderer.jsx/EditExamPage.jsx for
 * already-stored data, but fixing it here means newly generated questions
 * never carry the bad text in the first place). Applied to BOTH `options`
 * and `answer` — `isGeneratedQuestion` requires `answer` to appear verbatim
 * in `options`, so stripping only one side would break that match.
 */
const LEADING_OPTION_LABEL_RE = /^[A-Da-d][).:]\s+/;
function stripLeadingOptionLabel(s: string): string {
    return s.replace(LEADING_OPTION_LABEL_RE, '');
}

function normalizeGeneratedQuestionWhitespace(v: unknown): unknown {
    if (!v || typeof v !== 'object') return v;
    const q = v as Record<string, unknown>;
    return {
        ...q,
        question: typeof q.question === 'string' ? collapseWhitespace(q.question) : q.question,
        answer: typeof q.answer === 'string' ? collapseWhitespace(stripLeadingOptionLabel(q.answer)) : q.answer,
        explanation: typeof q.explanation === 'string' ? collapseWhitespace(q.explanation) : q.explanation,
        options: Array.isArray(q.options)
            ? q.options.map(o => (typeof o === 'string' ? collapseWhitespace(stripLeadingOptionLabel(o)) : o))
            : q.options,
        key_concepts: Array.isArray(q.key_concepts)
            ? q.key_concepts.map(k => (typeof k === 'string' ? collapseWhitespace(k) : k))
            : q.key_concepts,
    };
}

function isGeneratedQuestion(v: unknown): v is IGeneratedQuestion {
    const q = v as Partial<IGeneratedQuestion> | null;
    return (
        !!q &&
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every(o => typeof o === 'string') &&
        typeof q.answer === 'string' &&
        q.options.includes(q.answer) &&
        typeof q.explanation === 'string' &&
        typeof q.difficulty === 'number' &&
        Array.isArray(q.key_concepts)
    );
}

/**
 * Orchestrates the Generate → Judge → Refine loop from "Assessing the
 * Quality of AI-Generated Exams" (Isley et al., 2025):
 *   1. Generate one candidate question, seeded with up to 5 prior good + 5
 *      prior bad examples as in-context feedback.
 *   2. Judge it Keep/Remove.
 *   3. Repeat until `targetGoodQuestions` good questions are collected, or
 *      `maxIterations` total attempts are exhausted (whichever first).
 *   4. Final judge pass over every good question: difficulty, appropriateness,
 *      and an independent answer re-check; drop anything that fails either
 *      appropriateness or answer-confirmation.
 *   5. Sort the survivors by difficulty descending, return the top
 *      `numQuestions`.
 *
 * Jobs live in an in-memory Map, not a Mongo collection — a generation run
 * only needs to survive long enough for its own SSE stream plus a follow-up
 * `/save` call a few minutes later, not a server restart. `sweepExpiredJobs`
 * (called opportunistically on each new job) evicts anything past
 * `examGenAIConfig.jobTtlMs` so this can't leak memory on a long-running
 * server.
 */
@injectable()
export class QuestionGenerationService {
    private jobs = new Map<string, IExamGenJob>();

    constructor(
        @inject(EXAM_GENAI_TYPES.LlmClient) private readonly llm: LlmClient,
        @inject(EXAM_GENAI_TYPES.SseService) private readonly sse: SseService,
        @inject(EXAM_GENAI_TYPES.GeneratedQuestionRepo) private readonly generatedRepo: GeneratedQuestionRepository,
    ) {}

    private sweepExpiredJobs(): void {
        const cutoff = Date.now() - examGenAIConfig.jobTtlMs;
        for (const [id, job] of this.jobs) {
            if (job.updatedAt < cutoff) this.jobs.delete(id);
        }
    }

    /** Starts a job and returns its id immediately; the loop itself runs
     *  fire-and-forget (see `run`) and reports progress over SSE. */
    startJob(body: GenerateQuestionsBody, createdBy: string): string {
        this.sweepExpiredJobs();
        const jobId = randomUUID();
        const job: IExamGenJob = {
            jobId,
            createdBy,
            courseName: body.course_name,
            subject: body.subject as ExamGenSubject,
            numQuestions: body.num_questions ?? 10,
            difficultyLevel: body.difficulty_level ?? 'mixed',
            status: 'running',
            goodQuestions: [],
            badQuestions: [],
            finalQuestions: [],
            iteration: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.jobs.set(jobId, job);

        const materials: CourseMaterials = {
            courseName: body.course_name,
            subject: job.subject,
            courseDescription: body.course_description,
            syllabus: body.syllabus,
            pastExamContent: body.past_exam_content,
        };

        void this.run(job, materials).catch(err => {
            job.status = 'error';
            job.error = err instanceof Error ? err.message : String(err);
            job.updatedAt = Date.now();
            this.sse.send(job.jobId, 'progress', { stage: 'error', message: job.error });
        });

        return jobId;
    }

    getJob(jobId: string, requestedBy: string): IExamGenJob {
        const job = this.jobs.get(jobId);
        if (!job) throw new NotFoundError('Generation job not found (it may have expired)');
        if (job.createdBy !== requestedBy) throw new ForbiddenError('You cannot access another user\'s generation job');
        return job;
    }

    /** Replays the current/terminal state of a job to a freshly-connected SSE
     *  client — covers the case where the client connects to `/live` slightly
     *  after generation already finished. */
    replayCurrentState(job: IExamGenJob): void {
        if (job.status === 'complete') {
            this.sse.send(job.jobId, 'progress', { stage: 'complete', questions: job.finalQuestions });
        } else if (job.status === 'error') {
            this.sse.send(job.jobId, 'progress', { stage: 'error', message: job.error });
        } else {
            this.sse.send(job.jobId, 'progress', {
                stage: 'generating',
                good_count: job.goodQuestions.length,
                bad_count: job.badQuestions.length,
                iteration: job.iteration,
                provider: job.lastProvider,
                model: job.lastModel,
                last_question: job.lastQuestion,
            });
        }
    }

    /** How many generate+judge (or final-judge) calls run concurrently.
     *  MiniMax's shared-slot cap is 9 concurrent / 10 RPS (see
     *  examGenAIConfig.minimax, enforced by RateLimiter) — each in-flight
     *  worker below holds at most one call open at a time (generate, THEN
     *  judge, sequentially within itself), so this stays comfortably under
     *  that cap while still giving a big wall-clock win over the fully
     *  sequential loop this replaced. */
    private static readonly WORKER_CONCURRENCY = 5;

    /** Result of one generate+judge attempt, never throws except on a
     *  genuinely unexpected (non-LlmClientError) error — a total-provider
     *  failure is reported as `{ kind: 'failure' }` instead of rejecting, so
     *  Promise.all-ing several of these can't have one worker's infra error
     *  take down the others' in-flight work. */
    private async generateAndJudgeOne(
        materials: CourseMaterials,
        goodExamples: IGeneratedQuestion[],
        badExamples: IGeneratedQuestion[],
        difficultyLevel: ExamGenDifficultyLevel,
        coveredConcepts: string[],
    ): Promise<
        | { kind: 'failure'; error: LlmClientError }
        | { kind: 'no-candidate'; provider: ExamGenAIProvider; model: string }
        | { kind: 'judged'; candidate: IGeneratedQuestion; verdict: JudgeVerdict; provider: ExamGenAIProvider; model: string }
    > {
        try {
            const gen = await this.generateOne(materials, goodExamples, badExamples, difficultyLevel, coveredConcepts);
            if (!gen.candidate) return { kind: 'no-candidate', provider: gen.provider, model: gen.model };
            const judged = await this.judgeOne(materials, gen.candidate, goodExamples, coveredConcepts);
            return { kind: 'judged', candidate: gen.candidate, verdict: judged.verdict, provider: judged.provider, model: judged.model };
        } catch (err) {
            if (!(err instanceof LlmClientError)) throw err;
            return { kind: 'failure', error: err };
        }
    }

    /**
     * One worker in the generation pool: repeatedly claims the next
     * iteration slot and runs generate+judge until the job's target/limit is
     * hit or the circuit breaker trips. Several of these run concurrently
     * (see `run`) — `job.iteration`/`consecutiveFailures` increments happen
     * synchronously with no `await` in between, so despite N workers
     * touching the same job object there's no lost-update race (Node's
     * event loop only switches tasks at an `await`).
     *
     * `goodExamples`/`badExamples`/`coveredConcepts` are snapshotted from
     * job state at the START of each individual generate+judge call, not
     * shared across the whole batch — meaning concurrent workers can't see
     * each other's mid-flight results, only ones already fully committed.
     * This trades a little of the paper's per-iteration self-refinement
     * feedback for wall-clock speed; consecutive batches still see each
     * other's results normally.
     */
    private async generationWorker(job: IExamGenJob, materials: CourseMaterials): Promise<void> {
        const { targetGoodQuestions, maxIterations, feedbackExampleCount, consecutiveFailureLimit } = examGenAIConfig;

        while (job.status === 'running' && job.goodQuestions.length < targetGoodQuestions && job.iteration < maxIterations) {
            job.iteration += 1;

            const goodExamples = job.goodQuestions.slice(-feedbackExampleCount);
            const badExamples = job.badQuestions.slice(-feedbackExampleCount);
            const coveredConcepts = job.goodQuestions.flatMap(q => q.key_concepts);

            const result = await this.generateAndJudgeOne(materials, goodExamples, badExamples, job.difficultyLevel, coveredConcepts);

            if (result.kind === 'failure') {
                job.consecutiveFailures = (job.consecutiveFailures ?? 0) + 1;
                console.warn(`[QuestionGenerationService] provider call failed (${job.consecutiveFailures}/${consecutiveFailureLimit} consecutive):`, result.error);
                if (job.consecutiveFailures >= consecutiveFailureLimit) {
                    job.status = 'error';
                    job.error = `Every configured LLM provider failed ${job.consecutiveFailures} times in a row: ${result.error.message}`;
                    job.updatedAt = Date.now();
                    this.sse.send(job.jobId, 'progress', { stage: 'error', message: job.error });
                }
                continue;
            }

            job.consecutiveFailures = 0;
            job.lastProvider = result.provider;
            job.lastModel = result.model;

            if (result.kind === 'judged') {
                job.lastQuestion = { question: result.candidate.question, verdict: result.verdict, difficulty: result.candidate.difficulty };
                if (result.verdict === 'Keep') job.goodQuestions.push(result.candidate);
                else job.badQuestions.push(result.candidate);
            }

            job.updatedAt = Date.now();
            this.sse.send(job.jobId, 'progress', {
                stage: 'generating',
                good_count: job.goodQuestions.length,
                bad_count: job.badQuestions.length,
                iteration: job.iteration,
                provider: job.lastProvider,
                model: job.lastModel,
                last_question: job.lastQuestion,
            });
        }
    }

    private async run(job: IExamGenJob, materials: CourseMaterials): Promise<void> {
        const workers = Array.from({ length: QuestionGenerationService.WORKER_CONCURRENCY }, () =>
            this.generationWorker(job, materials),
        );
        await Promise.all(workers);

        if (job.status === 'error') return; // circuit breaker tripped inside a worker
        await this.finalJudge(job, materials);
    }

    /** `candidate` is null (not a rejection, a no-result) when the model's
     *  output fails schema validation — that's ordinary Generate→Judge→Refine
     *  churn, so the iteration just contributes nothing and moves on. A
     *  total provider failure instead throws LlmClientError, left
     *  unswallowed for `runWithCircuitBreaker` to count. */
    private async generateOne(
        materials: CourseMaterials,
        goodExamples: IGeneratedQuestion[],
        badExamples: IGeneratedQuestion[],
        difficultyLevel: ExamGenDifficultyLevel,
        coveredConcepts: string[],
    ): Promise<{ candidate: IGeneratedQuestion | null; provider: ExamGenAIProvider; model: string }> {
        const { system, prompt } = buildGeneratorPrompt(materials, goodExamples, badExamples, difficultyLevel, coveredConcepts);
        const { data: raw, provider, model } = await this.llm.completeJson('generator', system, prompt);
        const data = normalizeGeneratedQuestionWhitespace(raw);
        if (!isGeneratedQuestion(data)) {
            console.warn('[QuestionGenerationService] generator returned malformed question, skipping:', data);
            return { candidate: null, provider, model };
        }
        return { candidate: data, provider, model };
    }

    private async judgeOne(
        materials: CourseMaterials,
        candidate: IGeneratedQuestion,
        goodExamples: IGeneratedQuestion[],
        coveredConcepts: string[],
    ): Promise<{ verdict: JudgeVerdict; provider: ExamGenAIProvider; model: string }> {
        const prompt = buildJudgePrompt(materials, candidate, goodExamples, coveredConcepts);
        const { text, provider, model } = await this.llm.completeText(
            'judge',
            'You are a strict exam-question screening judge. Reply with exactly one word: Keep or Remove. ' +
            'If your reasoning process is visible (e.g. a <think> block), keep it to one or two sentences, ' +
            'then immediately give your one-word verdict — never spend your full response budget on reasoning alone.',
            prompt,
        );
        // An empty verdict (e.g. the model spent its whole budget on <think>
        // reasoning and never wrote Keep/Remove — see LlmClient.stripThinking)
        // is an infra failure, not a real judgment. Treating it as a normal
        // Remove would silently discard perfectly good candidates for a
        // reason that has nothing to do with their quality — throw instead
        // so runWithCircuitBreaker retries/counts it like any other failure.
        if (!text.trim()) {
            throw new LlmClientError('judge returned an empty verdict (likely exhausted its reasoning budget)');
        }
        return { verdict: /keep/i.test(text.trim()) ? 'Keep' : 'Remove', provider, model };
    }

    /** Each candidate's final judgment is fully independent of every other
     *  candidate's — unlike the generate+judge loop, there's no
     *  self-refinement feedback to lose by parallelizing this pass, so it
     *  runs at the same worker concurrency with no tradeoff. Workers pull
     *  from a shared index counter (`nextIndex`) rather than a fixed
     *  per-worker slice, so a worker that finishes early immediately picks
     *  up the next unclaimed question instead of idling. */
    private async finalJudge(job: IExamGenJob, materials: CourseMaterials): Promise<void> {
        const approved: (IGeneratedQuestion & { difficulty: number })[] = [];
        const total = job.goodQuestions.length;
        job.consecutiveFailures = 0;

        let nextIndex = 0;
        let completed = 0;

        const worker = async (): Promise<void> => {
            while (job.status === 'running') {
                const index = nextIndex++;
                if (index >= total) return;
                const candidate = job.goodQuestions[index];

                try {
                    const { verdict, provider, model } = await this.finalJudgeOne(materials, candidate);
                    job.consecutiveFailures = 0;
                    job.lastProvider = provider;
                    job.lastModel = model;
                    if (verdict && verdict.is_appropriate && verdict.answer_confirmed) {
                        approved.push({ ...candidate, difficulty: verdict.difficulty });
                    }
                } catch (err) {
                    if (!(err instanceof LlmClientError)) throw err;
                    job.consecutiveFailures = (job.consecutiveFailures ?? 0) + 1;
                    console.warn(`[QuestionGenerationService] final-judge call failed (${job.consecutiveFailures}/${examGenAIConfig.consecutiveFailureLimit} consecutive):`, err);
                    if (job.consecutiveFailures >= examGenAIConfig.consecutiveFailureLimit) {
                        job.status = 'error';
                        job.error = `Every configured LLM provider failed ${job.consecutiveFailures} times in a row: ${err.message}`;
                        job.updatedAt = Date.now();
                        this.sse.send(job.jobId, 'progress', { stage: 'error', message: job.error });
                        return;
                    }
                }

                completed += 1;
                this.sse.send(job.jobId, 'progress', { stage: 'final_judging', question_index: completed - 1, total });
            }
        };

        const workers = Array.from({ length: QuestionGenerationService.WORKER_CONCURRENCY }, () => worker());
        await Promise.all(workers);

        if (job.status === 'error') return; // circuit breaker tripped inside a worker

        job.finalQuestions = this.selectByDifficultyBand(approved, job.difficultyLevel, job.numQuestions);
        job.status = 'complete';
        job.updatedAt = Date.now();

        this.sse.send(job.jobId, 'progress', { stage: 'complete', questions: job.finalQuestions });
    }

    /** Malformed-verdict-shape returns a null verdict (rejects that one
     *  question, not an error); a total provider failure throws
     *  LlmClientError for `runWithCircuitBreaker` to count, same convention
     *  as `generateOne`. */
    private async finalJudgeOne(
        materials: CourseMaterials,
        candidate: IGeneratedQuestion,
    ): Promise<{ verdict: IFinalJudgeVerdict | null; provider: ExamGenAIProvider; model: string }> {
        const prompt = buildFinalJudgePrompt(materials, candidate);
        const { data, provider, model } = await this.llm.completeJson(
            'final_judge',
            'You are a rigorous exam-quality auditor. Reply with exactly one raw JSON object and nothing else. ' +
            'If your reasoning process is visible (e.g. a <think> block), keep it SHORT — a few sentences at ' +
            'most — then immediately write the final JSON object. Never spend your full response budget on ' +
            'reasoning alone.',
            prompt,
        );
        if (
            typeof data.difficulty !== 'number' ||
            typeof data.is_appropriate !== 'boolean' ||
            typeof data.answer_confirmed !== 'boolean'
        ) {
            console.warn('[QuestionGenerationService] final judge returned malformed verdict, rejecting question:', data);
            return { verdict: null, provider, model };
        }
        return { verdict: data as unknown as IFinalJudgeVerdict, provider, model };
    }

    /** 'mixed' (default) keeps the paper's original behavior: sort the whole
     *  approved pool hardest-first and take the top N. The three explicit
     *  bands instead pick the N questions whose (re-checked, final-judge)
     *  difficulty is CLOSEST to that band's center — "hard" still skews
     *  toward the harder end of the approved pool, but "easy"/"medium" no
     *  longer get overridden by the old always-take-the-hardest rule, which
     *  made an explicit easy/medium request pointless. */
    private selectByDifficultyBand(
        approved: (IGeneratedQuestion & { difficulty: number })[],
        level: ExamGenDifficultyLevel,
        numQuestions: number,
    ): IGeneratedQuestion[] {
        if (level === 'mixed') {
            return [...approved].sort((a, b) => b.difficulty - a.difficulty).slice(0, numQuestions);
        }
        const center = level === 'easy' ? 3 : level === 'medium' ? 5.5 : 8.5;
        return [...approved]
            .sort((a, b) => Math.abs(a.difficulty - center) - Math.abs(b.difficulty - center))
            .slice(0, numQuestions);
    }

    selectFinalQuestions(job: IExamGenJob, indices: number[] | undefined): IGeneratedQuestion[] {
        if (!indices || indices.length === 0) return job.finalQuestions;
        return indices
            .filter(i => Number.isInteger(i) && i >= 0 && i < job.finalQuestions.length)
            .map(i => job.finalQuestions[i]);
    }

    /**
     * Writes the audit record for a save action — one row per question,
     * tagged with where it actually went. Independent of the real
     * destination: ExamGenAIController separately embeds into the exam
     * (`ExamService.appendQuestions`) or creates a bank entry
     * (`QuestionBankService.addToBank`) before calling this; this collection
     * is generation history, not the source of truth for either.
     */
    async persistSaved(
        job: IExamGenJob,
        questions: IGeneratedQuestion[],
        target: 'draft' | 'exam' | 'bank',
        opts?: { examId?: string; bankEntryIds?: string[] },
    ): Promise<string[]> {
        const docs = questions.map((q, i) => ({
            jobId: job.jobId,
            courseName: job.courseName,
            subject: job.subject,
            question: q.question,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            difficulty: q.difficulty,
            key_concepts: q.key_concepts,
            target,
            examId: target === 'exam' ? opts?.examId ?? null : null,
            bankEntryId: target === 'bank' ? opts?.bankEntryIds?.[i] : undefined,
            createdBy: job.createdBy,
            createdAt: Date.now(),
        }));
        const inserted = await this.generatedRepo.insertMany(docs);
        return inserted.map(d => String(d._id));
    }
}
