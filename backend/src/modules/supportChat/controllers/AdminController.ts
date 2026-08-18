import { inject, injectable } from 'inversify';
import { subject } from '@casl/ability';
import {
  JsonController,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Params,
  QueryParams,
  Authorized,
  CurrentUser,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { AuthenticatedUser } from '#root/shared/interfaces/models.js';
import { ISupportQuestion, SupportQuestionStatus, SUPPORT_CHAT_TYPES } from '../types.js';
import { AdminService, SupportQueueScope } from '../services/index.js';
import {
  SupportChatActions,
  getSupportChatAbility,
  resolveSupportQueueCourseIds,
} from '../abilities/index.js';
import {
  AdminDashboardQuery,
  AdminFAQListQuery,
  AdminQuestionsQuery,
  AdminResponseBody,
  CreateFAQBody,
  FAQPathParams,
  SupportQuestionPathParams,
  UpdateFAQBody,
} from '../classes/validators/SupportChatValidators.js';

// '/api' comes from the app-level routePrefix; see ChatController.
@JsonController('/admin/support')
@injectable()
export class AdminController {
  constructor(@inject(SUPPORT_CHAT_TYPES.AdminService) private adminService: AdminService) {}

  /**
   * Narrows the queue to what this caller may read, optionally further down to
   * a single requested course. Anyone who staffs no course at all is refused
   * outright rather than served an empty list — the queue holds other
   * learners' questions, so "nothing to show" and "not yours to see" are
   * different answers.
   */
  private resolveScope(
    authenticatedUser: AuthenticatedUser,
    requestedCourseId?: string,
  ): SupportQueueScope {
    const courseIds = resolveSupportQueueCourseIds(authenticatedUser);

    if (courseIds && courseIds.length === 0) {
      throw new ForbiddenError('You do not have permission to view support questions');
    }

    if (!requestedCourseId) {
      return { courseIds };
    }

    const requested = new ObjectId(requestedCourseId);
    if (courseIds && !courseIds.some(id => id.equals(requested))) {
      throw new ForbiddenError('You do not have permission to view this course');
    }

    return { courseIds: [requested] };
  }

  /** Loads a question and confirms the caller may act on it. */
  private async authorizeQuestionAction(
    ability: any,
    questionId: ObjectId,
    action: SupportChatActions,
  ): Promise<ISupportQuestion> {
    const question = await this.adminService.getQuestionById(questionId);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const questionSubject = subject('SupportQuestion', {
      courseId: question.courseId?.toString(),
    });
    if (!ability.can(action, questionSubject)) {
      throw new ForbiddenError('You do not have permission to act on this question');
    }

    return question;
  }

  @Get('/dashboard')
  @Authorized()
  async getDashboard(
    @QueryParams() query: AdminDashboardQuery,
    @Ability(getSupportChatAbility) { authenticatedUser },
  ) {
    const scope = this.resolveScope(authenticatedUser, query.courseId);
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const stats = await this.adminService.getDashboardStats(scope, startDate, endDate);
    const openQuestions = await this.adminService.getQuestions(scope, { limit: 10 });

    return {
      stats,
      recentPending: openQuestions,
    };
  }

  @Get('/questions')
  @Authorized()
  async getQuestions(
    @QueryParams() query: AdminQuestionsQuery,
    @Ability(getSupportChatAbility) { authenticatedUser },
  ) {
    const scope = this.resolveScope(authenticatedUser, query.courseId);

    const questions = await this.adminService.getQuestions(scope, {
      status: query.status as SupportQuestionStatus | undefined,
      limit: query.limit ?? 50,
    });

    return {
      questions,
      total: questions.length,
    };
  }

  @Post('/questions/:questionId/respond')
  @Authorized()
  async respondToQuestion(
    @CurrentUser() user: any,
    @Params() params: SupportQuestionPathParams,
    @Body() request: AdminResponseBody,
    @Ability(getSupportChatAbility) { ability },
  ) {
    const qId = new ObjectId(params.questionId);
    await this.authorizeQuestionAction(ability, qId, SupportChatActions.Respond);

    const adminUserId = new ObjectId(user.id);
    return await this.adminService.respondToQuestion(qId, adminUserId, request);
  }

  @Put('/questions/:questionId/resolve')
  @Authorized()
  async resolveQuestion(
    @Params() params: SupportQuestionPathParams,
    @Ability(getSupportChatAbility) { ability },
  ) {
    const qId = new ObjectId(params.questionId);
    await this.authorizeQuestionAction(ability, qId, SupportChatActions.Respond);

    return await this.adminService.markQuestionResolved(qId);
  }

  @Get('/faqs')
  @Authorized()
  async getFAQs(
    @QueryParams() query: AdminFAQListQuery,
    @Ability(getSupportChatAbility) { ability },
  ) {
    this.assertCanManageFAQs(ability);
    const faqs = await this.adminService.getAllFAQs(query.category);

    return {
      faqs,
      total: faqs.length,
    };
  }

  @Post('/faqs')
  @Authorized()
  async createFAQ(
    @CurrentUser() user: any,
    @Body() faq: CreateFAQBody,
    @Ability(getSupportChatAbility) { ability },
  ) {
    this.assertCanManageFAQs(ability);
    const adminUserId = new ObjectId(user.id);
    return await this.adminService.createFAQ(
      {
        ...faq,
        upvotes: 0,
        downvotes: 0,
        usageCount: 0,
        isActive: faq.isActive !== false,
      },
      adminUserId
    );
  }

  @Put('/faqs/:faqId')
  @Authorized()
  async updateFAQ(
    @Params() params: FAQPathParams,
    @Body() updates: UpdateFAQBody,
    @Ability(getSupportChatAbility) { ability },
  ) {
    this.assertCanManageFAQs(ability);
    const id = new ObjectId(params.faqId);
    return await this.adminService.updateFAQ(id, updates);
  }

  @Delete('/faqs/:faqId')
  @Authorized()
  async deleteFAQ(
    @Params() params: FAQPathParams,
    @Ability(getSupportChatAbility) { ability },
  ) {
    this.assertCanManageFAQs(ability);
    const id = new ObjectId(params.faqId);
    const deleted = await this.adminService.deleteFAQ(id);

    return {
      success: deleted,
      message: deleted ? 'FAQ deleted successfully' : 'FAQ not found',
    };
  }

  private assertCanManageFAQs(ability: any) {
    if (!ability.can(SupportChatActions.ManageFAQ, 'SupportFAQ')) {
      throw new ForbiddenError('You do not have permission to manage FAQs');
    }
  }
}
