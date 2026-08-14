import { inject, injectable } from 'inversify';
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
} from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { SUPPORT_CHAT_TYPES } from '../types.js';
import { AdminService } from '../services/index.js';
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

@JsonController('/api/admin/support')
@injectable()
export class AdminController {
  constructor(@inject(SUPPORT_CHAT_TYPES.AdminService) private adminService: AdminService) {}

  @Get('/dashboard')
  @Authorized()
  async getDashboard(@QueryParams() query: AdminDashboardQuery) {
    const courseId = query.courseId ? new ObjectId(query.courseId) : undefined;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const stats = await this.adminService.getDashboardStats(courseId, startDate, endDate);
    const pendingQuestions = await this.adminService.getPendingQuestions(courseId, 10);

    return {
      stats,
      recentPending: pendingQuestions,
    };
  }

  @Get('/questions')
  @Authorized()
  async getQuestions(@QueryParams() query: AdminQuestionsQuery) {
    const limit = query.limit ?? 50;
    const courseId = query.courseId ? new ObjectId(query.courseId) : undefined;

    const questions = await this.adminService.getPendingQuestions(courseId, limit);

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
    @Body() request: AdminResponseBody
  ) {
    const qId = new ObjectId(params.questionId);
    const adminUserId = new ObjectId(user.id);

    return await this.adminService.respondToQuestion(qId, adminUserId, request);
  }

  @Put('/questions/:questionId/resolve')
  @Authorized()
  async resolveQuestion(@Params() params: SupportQuestionPathParams) {
    const qId = new ObjectId(params.questionId);
    return await this.adminService.markQuestionResolved(qId);
  }

  @Get('/faqs')
  @Authorized()
  async getFAQs(@QueryParams() query: AdminFAQListQuery) {
    const faqs = await this.adminService.getAllFAQs(query.category);

    return {
      faqs,
      total: faqs.length,
    };
  }

  @Post('/faqs')
  @Authorized()
  async createFAQ(@CurrentUser() user: any, @Body() faq: CreateFAQBody) {
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
    @Body() updates: UpdateFAQBody
  ) {
    const id = new ObjectId(params.faqId);
    return await this.adminService.updateFAQ(id, updates);
  }

  @Delete('/faqs/:faqId')
  @Authorized()
  async deleteFAQ(@Params() params: FAQPathParams) {
    const id = new ObjectId(params.faqId);
    const deleted = await this.adminService.deleteFAQ(id);

    return {
      success: deleted,
      message: deleted ? 'FAQ deleted successfully' : 'FAQ not found',
    };
  }
}
