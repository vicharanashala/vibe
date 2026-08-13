import { inject, injectable } from 'inversify';
import {
  JsonController,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  QueryParams,
  Authorized,
  CurrentUser,
} from 'routing-controllers';
import { ObjectId } from 'mongodb';
import {
  AdminResponseRequest,
  FAQCategory,
  IFAQ,
  SUPPORT_CHAT_TYPES,
} from '../types.js';
import { AdminService } from '../services/index.js';

@JsonController('/api/admin/support')
@injectable()
export class AdminController {
  constructor(@inject(SUPPORT_CHAT_TYPES.AdminService) private adminService: AdminService) {}

  @Get('/dashboard')
  @Authorized()
  async getDashboard(
    @QueryParams() query: { courseId?: string; startDate?: string; endDate?: string }
  ) {
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
  async getQuestions(
    @QueryParams() query: { status?: string; page?: string; limit?: string; courseId?: string }
  ) {
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
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
    @Param('questionId') questionId: string,
    @Body() request: AdminResponseRequest
  ) {
    const qId = new ObjectId(questionId);
    const adminUserId = new ObjectId(user.id);

    return await this.adminService.respondToQuestion(qId, adminUserId, request);
  }

  @Put('/questions/:questionId/resolve')
  @Authorized()
  async resolveQuestion(@Param('questionId') questionId: string) {
    const qId = new ObjectId(questionId);
    return await this.adminService.markQuestionResolved(qId);
  }

  @Get('/faqs')
  @Authorized()
  async getFAQs(@QueryParams() query: { category?: string }) {
    const category = query.category ? (query.category as FAQCategory) : undefined;
    const faqs = await this.adminService.getAllFAQs(category);

    return {
      faqs,
      total: faqs.length,
    };
  }

  @Post('/faqs')
  @Authorized()
  async createFAQ(
    @CurrentUser() user: any,
    @Body()
    faq: Omit<IFAQ, '_id' | 'createdAt' | 'updatedAt' | 'embedding' | 'createdBy'>
  ) {
    const adminUserId = new ObjectId(user.id);
    return await this.adminService.createFAQ(
      {
        ...faq,
        upvotes: faq.upvotes || 0,
        downvotes: faq.downvotes || 0,
        usageCount: faq.usageCount || 0,
        isActive: faq.isActive !== false,
      },
      adminUserId
    );
  }

  @Put('/faqs/:faqId')
  @Authorized()
  async updateFAQ(
    @Param('faqId') faqId: string,
    @Body() updates: Partial<IFAQ>
  ) {
    const id = new ObjectId(faqId);
    return await this.adminService.updateFAQ(id, updates);
  }

  @Delete('/faqs/:faqId')
  @Authorized()
  async deleteFAQ(@Param('faqId') faqId: string) {
    const id = new ObjectId(faqId);
    const deleted = await this.adminService.deleteFAQ(id);

    return {
      success: deleted,
      message: deleted ? 'FAQ deleted successfully' : 'FAQ not found',
    };
  }
}
