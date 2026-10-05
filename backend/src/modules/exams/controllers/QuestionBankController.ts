import 'reflect-metadata';
import {
    JsonController,
    Post,
    Get,
    Delete,
    HttpCode,
    Params,
    Body,
    QueryParam,
    Authorized,
    CurrentUser,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { OpenAPI } from 'routing-controllers-openapi';
import { EXAMS_TYPES } from '../types.js';
import { QuestionBankService } from '../services/QuestionBankService.js';
import { ExamService } from '../services/ExamService.js';
import { AddQuestionBody, ExamIdParams } from '../classes/validators/ExamValidators.js';
import { QuestionBankIdParams, AddQuestionsFromBankBody } from '../classes/validators/QuestionBankValidators.js';
import { assertOwnerOrAdmin } from './authz.js';
import { IUser } from '#root/shared/interfaces/models.js';

/**
 * Same `/exams` prefix as `ExamController`/`AttemptController` — the
 * question bank is logically nested under exams (its main purpose is
 * feeding questions INTO an exam), and its own CRUD routes share the same
 * "any authenticated user manages their own resources" auth model already
 * used throughout this module.
 *
 * Route-collision check (see `AttemptController`'s class doc for the
 * general rule this module already established: routing-controllers sits on
 * top of Express, which tests a request against registered routes in
 * REGISTRATION ORDER and dispatches to the first pattern+method match — it
 * does not prioritize literal segments over param segments on its own):
 *
 *   - `GET /exams/question-bank` and `POST /exams/question-bank` are each 1
 *     segment after `/exams` — the EXACT same shape as `ExamController`'s
 *     `GET /exams/:examId` (1 segment, param). This is a real collision,
 *     unlike the Attempt/Exam-controller pairing documented on
 *     `AttemptController` (those differ in segment count, so order there is
 *     cosmetic only): a request for `GET /exams/question-bank` WOULD be
 *     swallowed by `GET /exams/:examId` (binding `examId` to the literal
 *     string "question-bank") if that route were registered first. Route
 *     registration order follows *import*-evaluation order, not the
 *     `examsModuleControllers` array order — both `index.ts` and
 *     `container.ts` import `QuestionBankController` before `ExamController`
 *     for this reason. That alone isn't sufficient, though: this file used
 *     to import `assertOwnerOrAdmin` directly from `./ExamController.js`,
 *     which forces `ExamController.ts` to fully evaluate (registering its
 *     routes) as a dependency BEFORE this file's own routes register,
 *     regardless of import order anywhere else. `assertOwnerOrAdmin` now
 *     lives in `./authz.ts` (imported by both controllers, and re-exported
 *     from `ExamController.ts` for external consumers) specifically to
 *     avoid that cross-controller-file dependency — see `authz.ts`.
 *     (`POST /exams/question-bank` has no colliding same-method sibling —
 *     `ExamController`'s only other 1-segment POST-shaped route is
 *     `POST /exams/` at 0 segments — but is still registered under the same
 *     controller-order fix for consistency/simplicity.)
 *   - `DELETE /exams/question-bank/:questionId` is 2 segments (literal
 *     `question-bank`, then a param) — a different shape from every route
 *     on `ExamController` or `AttemptController` (none combine that literal
 *     with 2 segments), so it cannot collide regardless of registration
 *     order.
 *   - `POST /exams/:examId/questions/from-bank` is 3 segments: a param, the
 *     literal `questions`, then the literal `from-bank`. The only existing
 *     routes with that same segment count are `ExamController`'s
 *     `PATCH /exams/:examId/questions/:questionId` and
 *     `DELETE /exams/:examId/questions/:questionId` (same first two
 *     segments, but a param — not a literal — at the 3rd). Those differ by
 *     HTTP method (PATCH/DELETE vs. this route's POST): routing-controllers
 *     matches method AND path together, so a POST request is never even
 *     tested against a route registered for PATCH or DELETE — method alone
 *     fully disambiguates these, independent of registration order. This
 *     was verified directly (both routes' method + full path compared)
 *     rather than assumed, since the path *shapes* otherwise overlap. It
 *     also cannot collide with `ExamController`'s sibling
 *     `POST /exams/:examId/questions/bulk` (same segment count, same
 *     method): the literal 3rd segments (`from-bank` vs. `bulk`) are
 *     mutually exclusive on any concrete path, so that pair is
 *     order-independent too.
 */
@OpenAPI({
    tags: ['Exams'],
})
@JsonController('/exams', { transformResponse: true })
@injectable()
export class QuestionBankController {
    constructor(
        @inject(EXAMS_TYPES.QuestionBankService)
        private readonly questionBankService: QuestionBankService,
        @inject(EXAMS_TYPES.ExamService)
        private readonly examService: ExamService,
    ) {}

    // Add a question to the caller's bank
    @Authorized()
    @Post('/question-bank')
    @HttpCode(201)
    @OpenAPI({
        summary: "Add a question to the caller's question bank",
        description:
            'Exam-independent, reusable question storage. Any authenticated user ' +
            'may add to their own bank; same body shape as AddQuestionBody.',
    })
    async addToBank(@Body() body: AddQuestionBody, @CurrentUser() user: IUser) {
        return this.questionBankService.addToBank(body, user._id!.toString());
    }

    // List the caller's bank questions — must be registered before
    // GET /:examId on ExamController; see class doc above.
    @Authorized()
    @Get('/question-bank')
    @HttpCode(200)
    @OpenAPI({
        summary: "Get the current user's question-bank entries",
        description: 'Optional ?topic= / ?type= filters, applied in-memory after fetch.',
    })
    async listBank(
        @CurrentUser() user: IUser,
        @QueryParam('topic') topic?: string,
        @QueryParam('type') type?: string,
    ) {
        return this.questionBankService.listMine(user._id!.toString(), { topic, type });
    }

    // Remove a bank question (owner only)
    @Authorized()
    @Delete('/question-bank/:questionId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Remove a question from the question bank',
        description: 'Owner only.',
    })
    async removeFromBank(@Params() params: QuestionBankIdParams, @CurrentUser() user: IUser) {
        await this.questionBankService.remove(params.questionId, user._id!.toString());
        return { success: true };
    }

    // Copy bank questions into an exam (owner only) — ownership check
    // mirrors ExamController.addQuestion exactly (fetch the exam, then
    // assertOwnerOrAdmin) before delegating to the service.
    @Authorized()
    @Post('/:examId/questions/from-bank')
    @HttpCode(201)
    @OpenAPI({
        summary: 'Copy question-bank entries into an exam',
        description:
            'Owner only. Each copied question gets a fresh id, independent of the ' +
            "bank entry it came from. Only the caller's own bank entries are " +
            'copied — ids belonging to another teacher are silently skipped.',
    })
    async addFromBank(
        @Params() params: ExamIdParams,
        @Body() body: AddQuestionsFromBankBody,
        @CurrentUser() user: IUser,
    ) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.questionBankService.addToExam(params.examId, body.questionIds, user._id!.toString());
    }
}
