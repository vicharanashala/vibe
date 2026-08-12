import { inject, injectable } from 'inversify';
import {
  controller,
  httpPost,
  httpGet,
  httpPut,
  httpDelete,
  requestBody,
  pathParams,
  queryParams,
} from 'routing-controllers';
import { ObjectId } from 'mongodb';
import {
  AdminResponseRequest,
  FAQCategory,
  IFAQ,
  SUPPORT_CHAT_TYPES,
} from '../types.js';
import { AdminService } from '../services/index.js';
import { Authorized, CurrentUser } from '@/shared/decorators';

@controller('/api/admin/support')
@injectable()
export class AdminController {
  constructor(@inject(SUPPORT_CHAT_TYPES.AdminService) private adminService: AdminService) {}

  @httpGet('/dashboard')
  @Authorized('admin', 'staff')
  async getDashboard(
    @queryParams() query: { courseId?: string; startDate?: string; endDate?: string }
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

  @httpGet('/questions')
  @Authorized('admin', 'staff')
  async getQuestions(
    @queryParams() query: { status?: string; page?: string; limit?: string; courseId?: string }
  ) {
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const courseId = query.courseId ? new ObjectId(query.courseId) : undefined;

    const questions = await this.adminService.getPendingQuestions(courseId, limit);

    return {
      questions,
      total: questions.length,
    };
  }

  @httpPost('/questions/:questionId/respond')
  @Authorized('admin', 'staff')
  async respondToQuestion(
    @CurrentUser() user: any,
    @pathParams() params: { questionId: string },
    @requestBody() request: AdminResponseRequest
  ) {
    const questionId = new ObjectId(params.questionId);
    const adminUserId = new ObjectId(user.id);

    return await this.adminService.respondToQuestion(questionId, adminUserId, request);
  }

  @httpPut('/questions/:questionId/resolve')
  @Authorized('admin', 'staff')
  async resolveQuestion(@pathParams() params: { questionId: string }) {
    const questionId = new ObjectId(params.questionId);
    return await this.adminService.markQuestionResolved(questionId);
  }

  @httpGet('/faqs')
  @Authorized('admin', 'staff')
  async getFAQs(@queryParams() query: { category?: string }) {
    const category = query.category ? (query.category as FAQCategory) : undefined;
    const faqs = await this.adminService.getAllFAQs(category);

    return {
      faqs,
      total: faqs.length,
    };
  }

  @httpPost('/faqs')
  @Authorized('admin', 'staff')
  async createFAQ(
    @CurrentUser() user: any,
    @requestBody()
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

  @httpPut('/faqs/:faqId')
  @Authorized('admin', 'staff')
  async updateFAQ(
    @pathParams() params: { faqId: string },
    @requestBody() updates: Partial<IFAQ>
  ) {
    const faqId = new ObjectId(params.faqId);
    return await this.adminService.updateFAQ(faqId, updates);
  }

  @httpDelete('/faqs/:faqId')
  @Authorized('admin', 'staff')
  async deleteFAQ(@pathParams() params: { faqId: string }) {
    const faqId = new ObjectId(params.faqId);
    const deleted = await this.adminService.deleteFAQ(faqId);

    return {
      success: deleted,
      message: deleted ? 'FAQ deleted successfully' : 'FAQ not found',
    };
  }
}
