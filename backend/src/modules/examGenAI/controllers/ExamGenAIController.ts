import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { injectable, inject } from 'inversify';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import {
    JsonController,
    Post,
    Get,
    HttpCode,
    Params,
    Body,
    Authorized,
    CurrentUser,
    BadRequestError,
    Req,
    Res,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { IUser } from '#root/shared/interfaces/models.js';
import { EXAMS_TYPES } from '#root/modules/exams/types.js';
import {
    ExamService,
    QuestionBankService,
    assertOwnerOrAdmin,
    IExamQuestion,
    IExamQuestionOption,
    AddQuestionBody,
} from '#root/modules/exams/index.js';
import { EXAM_GENAI_TYPES } from '../types.js';
import { QuestionGenerationService } from '../services/QuestionGenerationService.js';
import { SseService } from '../services/SseService.js';
import { GeneratedQuestionRepository } from '../repositories/providers/mongodb/GeneratedQuestionRepository.js';
import { GenerateQuestionsBody, JobIdParams, SaveGeneratedQuestionsBody } from '../classes/validators/ExamGenAIValidators.js';
import { IGeneratedQuestion } from '../classes/transformers/ExamGenAI.js';

/** Shared by `toExamQuestion`/`toAddQuestionBody`: builds MCQ options with
 *  fresh ids and finds which one is correct by matching `answer`'s text —
 *  the generator/judge prompts produce `answer` as the correct option's
 *  exact text (see PromptBuilder.ts), not an id/index, since that's the
 *  shape the model naturally produces. */
function buildOptions(q: IGeneratedQuestion): { options: IExamQuestionOption[]; correctOptions: string[] } {
    const options: IExamQuestionOption[] = q.options.map(text => ({ id: randomUUID(), text }));
    const correct = options.find(o => o.text === q.answer);
    return { options, correctOptions: correct ? [correct.id] : [] };
}

/** Converts one generator/judge output into the exam module's embedded
 *  question shape (see backend/src/modules/exams/classes/transformers/Exam.ts).
 *  Always MCQ: the paper's pipeline and this module's prompts only ever
 *  produce single-correct-answer multiple choice. */
function toExamQuestion(q: IGeneratedQuestion): IExamQuestion {
    const { options, correctOptions } = buildOptions(q);
    return {
        id: randomUUID(),
        type: 'MCQ',
        questionText: q.question,
        options,
        correctOptions,
        marks: 1,
        negativeMarks: 0,
        useCustomNegative: false,
        explanation: q.explanation,
        topic: q.key_concepts.join(', '),
    };
}

/** Converts one generator/judge output into the shape
 *  `QuestionBankService.addToBank` expects. Built as a plain object (not a
 *  real class-validator instance) since this call bypasses the HTTP
 *  validation pipeline entirely — addToBank only ever reads plain fields off
 *  it, so a structurally-matching object is sufficient. */
function toAddQuestionBody(q: IGeneratedQuestion): AddQuestionBody {
    const { options, correctOptions } = buildOptions(q);
    return {
        type: 'MCQ',
        questionText: q.question,
        options,
        correctOptions,
        marks: 1,
        negativeMarks: 0,
        useCustomNegative: false,
        explanation: q.explanation,
        topic: q.key_concepts.join(', '),
    } as AddQuestionBody;
}

@OpenAPI({ tags: ['ExamGenAI'] })
@JsonController('/exam-genai', { transformResponse: true })
@injectable()
export class ExamGenAIController {
    constructor(
        @inject(EXAM_GENAI_TYPES.QuestionGenerationService)
        private readonly generationService: QuestionGenerationService,
        @inject(EXAM_GENAI_TYPES.SseService)
        private readonly sseService: SseService,
        @inject(EXAM_GENAI_TYPES.GeneratedQuestionRepo)
        private readonly generatedRepo: GeneratedQuestionRepository,
        @inject(EXAMS_TYPES.ExamService)
        private readonly examService: ExamService,
        @inject(EXAMS_TYPES.QuestionBankService)
        private readonly questionBankService: QuestionBankService,
    ) {}

    // Kicks off the Generate→Judge→Refine loop and returns immediately;
    // progress/results stream over `/​:jobId/live` (SSE). Generation itself
    // can take minutes, which is why this is fire-and-forget rather than a
    // single long-held request (see QuestionGenerationService.startJob).
    @Post('/generate')
    @HttpCode(202)
    @Authorized()
    @OpenAPI({ summary: 'Start an AI question-generation job', description: 'Returns a jobId immediately; connect to /exam-genai/:jobId/live for progress.' })
    async generate(@Body() body: GenerateQuestionsBody, @CurrentUser() user: IUser) {
        const jobId = this.generationService.startJob(body, user._id!.toString());
        return { jobId };
    }

    // SSE stream of job progress. Uses @Res()/@Req() for manual response
    // control instead of a JSON return. Must `return res` at the end —
    // routing-controllers' ExpressDriver.handleSuccess only skips its own
    // auto-response (NotFoundError/res.json() on an `undefined` result,
    // both of which crash with ERR_HTTP_HEADERS_SENT here since the SSE
    // headers/body are already flushed) when the returned value is
    // `=== options.response`, i.e. the exact injected @Res() object.
    @Get('/:jobId/live')
    @Authorized()
    @OpenAPI({ summary: 'Live progress stream (SSE) for a generation job' })
    async live(@Params() params: JobIdParams, @CurrentUser() user: IUser, @Res() res: ExpressResponse, @Req() req: ExpressRequest) {
        const job = this.generationService.getJob(params.jobId, user._id!.toString());
        this.sseService.init(req, res, params.jobId);
        this.generationService.replayCurrentState(job);
        return res;
    }

    // Persists selected questions from a completed job to one of three
    // places: an unattached draft, embedded into an exam's question list
    // (exam_id required, requires owning the exam), or the caller's
    // question bank. Every path also writes an audit row via
    // `generationService.persistSaved` — see its doc comment.
    @Post('/:jobId/save')
    @Authorized()
    @OpenAPI({ summary: 'Save generated questions as a draft, attach them to an exam, or add them to the question bank' })
    async save(@Params() params: JobIdParams, @Body() body: SaveGeneratedQuestionsBody, @CurrentUser() user: IUser) {
        const job = this.generationService.getJob(params.jobId, user._id!.toString());
        if (job.status !== 'complete') {
            return { saved: false, message: 'Job has not finished generating yet' };
        }

        const selected = this.generationService.selectFinalQuestions(job, body.selected_indices);
        if (selected.length === 0) {
            return { saved: false, message: 'No questions selected' };
        }

        if (body.target === 'exam') {
            if (!body.exam_id) throw new BadRequestError('exam_id is required when target is "exam"');
            const exam = await this.examService.getExamById(body.exam_id);
            assertOwnerOrAdmin(exam.createdBy, user);
            await this.examService.appendQuestions(body.exam_id, selected.map(toExamQuestion));
            await this.generationService.persistSaved(job, selected, 'exam', { examId: body.exam_id });
            return { saved: true, target: 'exam', examId: body.exam_id, count: selected.length };
        }

        if (body.target === 'bank') {
            const userId = user._id!.toString();
            const entries = await Promise.all(
                selected.map(q => this.questionBankService.addToBank(toAddQuestionBody(q), userId)),
            );
            const bankEntryIds = entries.map(e => e.id);
            await this.generationService.persistSaved(job, selected, 'bank', { bankEntryIds });
            return { saved: true, target: 'bank', count: selected.length, bankEntryIds };
        }

        const ids = await this.generationService.persistSaved(job, selected, 'draft');
        return { saved: true, target: 'draft', count: ids.length, ids };
    }

    @Get('/drafts')
    @Authorized()
    @OpenAPI({ summary: 'List this user\'s saved-but-unattached AI-generated questions' })
    async drafts(@CurrentUser() user: IUser) {
        return this.generatedRepo.findDraftsByCreator(user._id!.toString());
    }
}
