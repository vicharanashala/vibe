import { inject, injectable } from 'inversify';
import { ObjectId } from 'mongodb';
import {
  AdminResponseRequest,
  IFAQ,
  ISupportQuestion,
  SupportQuestionStatus,
  SUPPORT_CHAT_TYPES,
  FAQCategory,
  FAQSource,
} from '../types.js';
import { FAQRepository } from '../repositories/providers/mongodb/index.js';
import { SupportQuestionRepository } from '../repositories/providers/mongodb/index.js';
import { FAQRetrievalService } from './FAQRetrievalService.js';
@injectable()
export class AdminService {

  constructor(
    @inject(SUPPORT_CHAT_TYPES.FAQRepo) private faqRepo: FAQRepository,
    @inject(SUPPORT_CHAT_TYPES.SupportQuestionRepo) private questionRepo: SupportQuestionRepository,
    @inject(SUPPORT_CHAT_TYPES.FAQRetrievalService) private faqRetrieval: FAQRetrievalService
  ) {}

  async getPendingQuestions(courseId?: ObjectId, limit: number = 50): Promise<ISupportQuestion[]> {
    try {
      if (courseId) {
        return await this.questionRepo.findByCourseId(courseId, {
          status: SupportQuestionStatus.PENDING,
        });
      }
      return await this.questionRepo.findPending(limit);
    } catch (error) {
      console.error('Error fetching pending questions', error);
      throw error;
    }
  }

  async respondToQuestion(
    questionId: ObjectId,
    adminUserId: ObjectId,
    request: AdminResponseRequest
  ): Promise<ISupportQuestion | null> {
    try {
      let faqId: ObjectId | undefined;

      // Create FAQ if requested
      if (request.createFaq) {
        const question = await this.questionRepo.findById(questionId);
        if (!question) {
          throw new Error(`Question ${questionId} not found`);
        }

        const newFAQ = await this.faqRepo.create({
          question: question.question,
          answer: request.response,
          category: request.faqCategory || FAQCategory.OTHER,
          tags: request.faqTags || [],
          embedding: await this.faqRetrieval.generateEmbeddingForFAQ({
            question: question.question,
            answer: request.response,
          } as IFAQ),
          upvotes: 0,
          downvotes: 0,
          usageCount: 0,
          createdBy: adminUserId,
          isActive: true,
          source: FAQSource.ADMIN_RESPONSE,
        });

        faqId = newFAQ._id;

        // Link FAQ to original question
        await this.questionRepo.linkFaqCreated(questionId, newFAQ._id!);

        console.log(`Created FAQ ${newFAQ._id} from question ${questionId}`);
      }

      // Set admin response on question
      const updated = await this.questionRepo.setAdminResponse(
        questionId,
        request.response,
        adminUserId
      );

      console.log(`Admin ${adminUserId} responded to question ${questionId}`);

      return updated;
    } catch (error) {
      console.error('Error responding to question', error);
      throw error;
    }
  }

  async getDashboardStats(courseId?: ObjectId, startDate?: Date, endDate?: Date) {
    try {
      const stats = await this.questionRepo.getStats(courseId, startDate, endDate);

      const allQuestions = courseId
        ? await this.questionRepo.findByCourseId(courseId)
        : await this.questionRepo.findByStatus(SupportQuestionStatus.ANSWERED);

      const helpfulCount = allQuestions.filter((q) => q.resolutionRating === 'helpful').length;
      const totalRated = allQuestions.filter((q) => q.resolutionRating).length;
      const satisfactionRate = totalRated > 0 ? (helpfulCount / totalRated) * 100 : 0;

      return {
        totalQuestions: stats.total,
        pending: stats.byStatus[SupportQuestionStatus.PENDING],
        answered: stats.byStatus[SupportQuestionStatus.ANSWERED],
        resolved: stats.byStatus[SupportQuestionStatus.RESOLVED],
        avgResolutionTime: stats.avgResolutionTime,
        satisfactionRate,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats', error);
      throw error;
    }
  }

  async getAllFAQs(category?: FAQCategory): Promise<IFAQ[]> {
    try {
      return await this.faqRepo.findAll({
        isActive: true,
        category,
      });
    } catch (error) {
      console.error('Error fetching FAQs', error);
      throw error;
    }
  }

  async createFAQ(
    faq: Omit<IFAQ, '_id' | 'createdAt' | 'updatedAt' | 'embedding'>,
    adminUserId: ObjectId
  ): Promise<IFAQ> {
    try {
      const embedding = await this.faqRetrieval.generateEmbeddingForFAQ(faq as IFAQ);

      return await this.faqRepo.create({
        ...faq,
        embedding,
        createdBy: adminUserId,
      });
    } catch (error) {
      console.error('Error creating FAQ', error);
      throw error;
    }
  }

  async updateFAQ(faqId: ObjectId, updates: Partial<IFAQ>): Promise<IFAQ | null> {
    try {
      return await this.faqRepo.updateById(faqId, updates);
    } catch (error) {
      console.error('Error updating FAQ', error);
      throw error;
    }
  }

  async deleteFAQ(faqId: ObjectId): Promise<boolean> {
    try {
      const result = await this.faqRepo.deleteById(faqId);
      if (result) {
        console.log(`FAQ ${faqId} deleted`);
      }
      return result;
    } catch (error) {
      console.error('Error deleting FAQ', error);
      throw error;
    }
  }

  async markQuestionResolved(questionId: ObjectId): Promise<ISupportQuestion | null> {
    try {
      return await this.questionRepo.updateStatus(questionId, SupportQuestionStatus.RESOLVED);
    } catch (error) {
      console.error('Error marking question resolved', error);
      throw error;
    }
  }
}
