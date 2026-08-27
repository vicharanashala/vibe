import 'reflect-metadata';
import {
    JsonController,
    Post,
    Patch,
    Delete,
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
import { ExamService } from '../services/ExamService.js';
import {
    ExamIdParams,
    QuestionIdParams,
    TimeGrantIdParams,
    CreateExamBody,
    UpdateExamBody,
    AddQuestionBody,
    UpdateQuestionBody,
    AddTimeGrantBody,
    RedeemGrantBody,
    BulkAddQuestionsBody,
} from '../classes/validators/ExamValidators.js';
import { IUser } from '#root/shared/interfaces/models.js';

// Imported (not defined here) and re-exported for external consumers, so
// importing it — e.g. from `QuestionBankController` — doesn't force this
// file to evaluate first and register its `/exams/:examId` route ahead of
// literal sibling routes. See `authz.ts` for the full explanation.
import { assertOwnerOrAdmin } from './authz.js';
export { assertOwnerOrAdmin };

@OpenAPI({
    tags: ['Exams'],
})
@JsonController('/exams', { transformResponse: true })
@injectable()
export class ExamController {
    constructor(
        @inject(EXAMS_TYPES.ExamService)
        private readonly examService: ExamService,
    ) {}

    // Teacher's own exams (AdminPage manage list)
    @Authorized()
    @Get('/')
    @HttpCode(200)
    @OpenAPI({
        summary: "Get the current user's exams",
        description: 'Exams created by the currently authenticated user.',
    })
    async getMyExams(@CurrentUser() user: IUser) {
        return this.examService.findByCreator(user._id!.toString());
    }

    // Published exams for students (HomePage)
    @Authorized()
    @Get('/published')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Get published exams',
        description: 'All exams marked published, visible to any authenticated user.',
    })
    async getPublishedExams(@CurrentUser() user: IUser) {
        return this.examService.findPublished(user);
    }

    // Single exam (EditExamPage / ExamPage)
    @Authorized()
    @Get('/:examId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Get a single exam by id',
        description:
            'Owner/admin always succeed; any other user is subject to the ' +
            "exam's `eligibility` gate (403 if not eligible).",
    })
    async getExam(@Params() params: ExamIdParams, @CurrentUser() user: IUser) {
        return this.examService.getExamForUser(params.examId, user);
    }

    // Create exam
    @Authorized()
    @Post('/')
    @HttpCode(201)
    @OpenAPI({
        summary: 'Create an exam',
        description: 'Any authenticated user may create an exam.',
    })
    async createExam(@Body() body: CreateExamBody, @CurrentUser() user: IUser) {
        return this.examService.createExam(body, user._id!.toString());
    }

    // Update exam / toggle publish (owner/admin only)
    @Authorized()
    @Patch('/:examId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Update an exam',
        description:
            'Partial update, also used to toggle publish state by sending ' +
            '{ published: true|false }. Owner or admin only.',
    })
    async updateExam(
        @Params() params: ExamIdParams,
        @Body() body: UpdateExamBody,
        @CurrentUser() user: IUser,
    ) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.examService.updateExam(params.examId, body);
    }

    // Delete exam (owner/admin only)
    @Authorized()
    @Delete('/:examId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Delete an exam',
        description: 'Owner or admin only.',
    })
    async deleteExam(@Params() params: ExamIdParams, @CurrentUser() user: IUser) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        await this.examService.deleteExam(params.examId);
        return { success: true };
    }

    // Add question (owner only)
    @Authorized()
    @Post('/:examId/questions')
    @HttpCode(201)
    @OpenAPI({
        summary: 'Add a question to an exam',
        description: 'Owner only.',
    })
    async addQuestion(
        @Params() params: ExamIdParams,
        @Body() body: AddQuestionBody,
        @CurrentUser() user: IUser,
    ) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.examService.addQuestion(params.examId, body);
    }

    // Bulk-add questions (owner only) — for CSV import. Appends every
    // question to `exam.questions` in one update via
    // `ExamService.addQuestionsBulk` rather than N sequential
    // `POST /:examId/questions` calls.
    //
    // Route-collision check against QuestionBankController's
    // `POST /:examId/questions/from-bank` (same segment count/shape, literal
    // 3rd segment) and this controller's own
    // `PATCH/DELETE /:examId/questions/:questionId` (same segment count, but
    // a param instead of a literal at the 3rd segment): see
    // `QuestionBankController`'s class doc for the full analysis — in short,
    // this route's method (POST) never overlaps with the PATCH/DELETE
    // question routes regardless of path shape, and the literal 3rd segment
    // (`bulk`) is mutually exclusive with `from-bank` on any concrete path,
    // so registration order between the two controllers does not matter for
    // this route (unlike the `/question-bank` vs `/:examId` collision noted
    // on `QuestionBankController`, which DOES require ordering).
    @Authorized()
    @Post('/:examId/questions/bulk')
    @HttpCode(201)
    @OpenAPI({
        summary: 'Bulk-add questions to an exam',
        description:
            'Owner only. Appends all questions in a single update, not N sequential ' +
            'single-question calls — intended for CSV import.',
    })
    async addQuestionsBulk(
        @Params() params: ExamIdParams,
        @Body() body: BulkAddQuestionsBody,
        @CurrentUser() user: IUser,
    ) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.examService.addQuestionsBulk(params.examId, body.questions);
    }

    // Update question (owner only)
    @Authorized()
    @Patch('/:examId/questions/:questionId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Update a question on an exam',
        description: 'Owner only.',
    })
    async updateQuestion(
        @Params() params: QuestionIdParams,
        @Body() body: UpdateQuestionBody,
        @CurrentUser() user: IUser,
    ) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.examService.updateQuestion(params.examId, params.questionId, body);
    }

    // Remove question (owner only)
    @Authorized()
    @Delete('/:examId/questions/:questionId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Remove a question from an exam',
        description: 'Owner only.',
    })
    async removeQuestion(@Params() params: QuestionIdParams, @CurrentUser() user: IUser) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.examService.removeQuestion(params.examId, params.questionId);
    }

    // Add extra-time grant (owner only)
    @Authorized()
    @Post('/:examId/time-grants')
    @HttpCode(201)
    @OpenAPI({
        summary: 'Add an extra-time grant code to an exam',
        description: 'Owner only.',
    })
    async addTimeGrant(
        @Params() params: ExamIdParams,
        @Body() body: AddTimeGrantBody,
        @CurrentUser() user: IUser,
    ) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.examService.addTimeGrant(params.examId, body);
    }

    // Remove extra-time grant (owner only)
    @Authorized()
    @Delete('/:examId/time-grants/:grantId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Remove an extra-time grant from an exam',
        description: 'Owner only.',
    })
    async removeTimeGrant(@Params() params: TimeGrantIdParams, @CurrentUser() user: IUser) {
        const existing = await this.examService.getExamById(params.examId);
        assertOwnerOrAdmin(existing.createdBy, user);
        return this.examService.removeTimeGrant(params.examId, params.grantId);
    }

    // Redeem an extra-time grant code (any authenticated user)
    @Authorized()
    @Post('/:examId/redeem-grant')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Redeem an extra-time grant code',
        description:
            'Any authenticated user (typically a student mid-exam) may attempt to ' +
            'redeem a code. Returns { ok: false, error } rather than an HTTP error ' +
            'for an invalid/used code, since that is an expected outcome.',
    })
    async redeemGrant(@Params() params: ExamIdParams, @Body() body: RedeemGrantBody) {
        return this.examService.redeemTimeGrant(params.examId, body.code);
    }
}
