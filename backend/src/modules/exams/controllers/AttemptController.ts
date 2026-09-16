import 'reflect-metadata';
import {
    JsonController,
    Post,
    Get,
    HttpCode,
    Params,
    Body,
    Authorized,
    CurrentUser,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { OpenAPI } from 'routing-controllers-openapi';
import { EXAMS_TYPES } from '../types.js';
import { AttemptService } from '../services/AttemptService.js';
import { ExamIdParams } from '../classes/validators/ExamValidators.js';
import { AttemptIdParams, SubmitAttemptBody } from '../classes/validators/AttemptValidators.js';
import { IUser } from '#root/shared/interfaces/models.js';

/**
 * Same `/exams` prefix as `ExamController`, since these routes are logically
 * nested under an exam ("submit an attempt for this exam") or under the
 * attempts sub-resource ("my attempts", "one attempt by id").
 *
 * Route-collision check (routing-controllers/Express matches literal path
 * segments before params, in registration order, and never matches across
 * differing segment counts or HTTP methods):
 *   - `GET /exams/attempts/mine` and `GET /exams/attempts/:attemptId` are
 *     both 2 segments after `/exams`, so `mine` WOULD be swallowed by
 *     `:attemptId` if that route were registered first — hence `mine` is
 *     declared before `:attemptId` below.
 *   - `GET /exams/:examId` (ExamController, 1 segment) cannot match
 *     `/exams/attempts/mine` or `/exams/attempts/:attemptId` (2 segments
 *     each) — Express requires an exact segment-count match, so there is no
 *     collision between the two controllers regardless of registration
 *     order. `examsModuleControllers` still lists this controller first, as
 *     a defensive convention (literal/nested routes before single-param
 *     ones), even though it is not load-bearing here.
 *   - `POST /exams/:examId/attempts` differs from every ExamController route
 *     by method and/or literal suffix, so it cannot collide either.
 *   - `GET /exams/:examId/attempts` (param at segment 1, literal `attempts`
 *     at segment 2) is a different *shape* from `GET /exams/attempts/mine`
 *     and `GET /exams/attempts/:attemptId` (both literal `attempts` at
 *     segment 1). A concrete path can only match one of these three
 *     patterns: `/exams/attempts/mine` has segment 1 `attempts`, which is
 *     also literal-required by the other two `attempts/...` routes but NOT
 *     by `:examId/attempts` unless `examId` happened to literally be the
 *     string `attempts` AND segment 2 happened to literally be `attempts` —
 *     impossible here since segment 2 of `/exams/attempts/mine` is `mine`,
 *     not `attempts`. Conversely `/exams/abc123/attempts` has segment 1
 *     `abc123`, which fails the literal-`attempts` requirement of the other
 *     two routes outright, leaving only `:examId/attempts` to match. So all
 *     three GET routes are mutually exclusive on any concrete path,
 *     independent of registration order; it is still registered after
 *     `submitAttempt` (grouped with the other `:examId/attempts`-shaped
 *     route) and before `mine`/`:attemptId`, matching this file's existing
 *     defensive convention.
 *   - `GET /exams/:examId/attempts` (2 segments) also cannot collide with
 *     `GET /exams/:examId` (ExamController, 1 segment) — different segment
 *     counts.
 */
@OpenAPI({
    tags: ['Exams'],
})
@JsonController('/exams', { transformResponse: true })
@injectable()
export class AttemptController {
    constructor(
        @inject(EXAMS_TYPES.AttemptService)
        private readonly attemptService: AttemptService,
    ) {}

    // Submit attempt -> authoritative score, persisted
    @Authorized()
    @Post('/:examId/attempts')
    @HttpCode(201)
    @OpenAPI({
        summary: 'Submit an exam attempt',
        description:
            'Recomputes score/correctCount server-side from the exam\'s stored ' +
            'questions rather than trusting any client-submitted score. Rejected ' +
            '(403) if the exam has a scheduling window (opensAt/closesAt) and the ' +
            'submission falls outside it, or if the exam has allowRetakes: false ' +
            'and the student already has an attempt for this exam.',
    })
    async submitAttempt(
        @Params() params: ExamIdParams,
        // Raised from the framework default: an attempt can now carry several
        // client-captured proctoring-violation screenshots (imageDataUrl), same
        // rationale as UserController's face-reference upload.
        @Body({ options: { limit: '20mb' } }) body: SubmitAttemptBody,
        @CurrentUser() user: IUser,
    ) {
        return this.attemptService.submitAttempt(
            params.examId,
            user,
            body.responses,
            {
                tabSwitches: body.tabSwitches,
                startedAt: body.startedAt,
                proctoringEvents: body.proctoringEvents,
            },
        );
    }

    // All attempts for an exam (teacher-facing; owner or admin only) — must be
    // registered before GET /attempts/mine and /attempts/:attemptId per the
    // class-level route-collision note above (defensive convention only; the
    // three patterns are mutually exclusive regardless of order).
    @Authorized()
    @Get('/:examId/attempts')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Get all attempts for an exam',
        description: 'Owner of the exam or an admin only.',
    })
    async getAttemptsForExam(@Params() params: ExamIdParams, @CurrentUser() user: IUser) {
        return this.attemptService.listByExam(params.examId, user);
    }

    // Current student's attempt history (MyTestsPage) — must be registered
    // before GET /attempts/:attemptId, see class-level note above.
    @Authorized()
    @Get('/attempts/mine')
    @HttpCode(200)
    @OpenAPI({
        summary: "Get the current user's exam attempts",
    })
    async getMyAttempts(@CurrentUser() user: IUser) {
        return this.attemptService.listByStudent(user._id!.toString());
    }

    // Single result (ResultPage; must be own attempt, the exam owner, or admin)
    @Authorized()
    @Get('/attempts/:attemptId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Get a single exam attempt by id',
        description: 'Must belong to the requester, or the requester must own the exam or be an admin.',
    })
    async getAttempt(@Params() params: AttemptIdParams, @CurrentUser() user: IUser) {
        return this.attemptService.getById(params.attemptId, user);
    }
}
