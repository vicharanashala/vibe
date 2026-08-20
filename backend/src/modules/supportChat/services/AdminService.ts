import { inject, injectable } from 'inversify';
import { ObjectId } from 'mongodb';
import {
  AdminResponseRequest,
  IFAQ,
  ISupportQuestion,
  OPEN_SUPPORT_QUESTION_STATUSES,
  SupportQuestionStatus,
  SUPPORT_CHAT_TYPES,
  FAQCategory,
  FAQSource,
} from '../types.js';
import { FAQRepository } from '../repositories/providers/mongodb/index.js';
import { SupportQuestionRepository } from '../repositories/providers/mongodb/index.js';
import { FAQRetrievalService } from './FAQRetrievalService.js';

/**
 * How far the caller can see. `courseIds` undefined means every course, which
 * only an admin is ever granted; an empty array means nothing is in reach.
 */
export interface SupportQueueScope {
  courseIds?: ObjectId[];
}

/** Cap on the sample the satisfaction rate is averaged over. */
const RATING_SAMPLE_LIMIT = 500;

@injectable()
export class AdminService {

  constructor(
    @inject(SUPPORT_CHAT_TYPES.FAQRepo) private faqRepo: FAQRepository,
    @inject(SUPPORT_CHAT_TYPES.SupportQuestionRepo) private questionRepo: SupportQuestionRepository,
    @inject(SUPPORT_CHAT_TYPES.FAQRetrievalService) private faqRetrieval: FAQRetrievalService
  ) {}

  /**
   * The admin queue. `scope.courseIds` is the caller's reach as resolved by the
   * controller: undefined for admins, the instructor's own courses otherwise.
   * With no status filter it returns the open queue — escalated first-class,
   * plus anything left PENDING by an interrupted chat turn.
   */
  async getQuestions(
    scope: SupportQueueScope,
    options: { status?: SupportQuestionStatus; limit?: number } = {}
  ): Promise<ISupportQuestion[]> {
    try {
      return await this.questionRepo.findForAdmin({
        statuses: options.status ? [options.status] : [...OPEN_SUPPORT_QUESTION_STATUSES],
        courseIds: scope.courseIds,
        limit: options.limit ?? 50,
      });
    } catch (error) {
      console.error('Error fetching support questions', error);
      throw error;
    }
  }

  async getQuestionById(questionId: ObjectId): Promise<ISupportQuestion | null> {
    try {
      return await this.questionRepo.findById(questionId);
    } catch (error) {
      console.error('Error fetching support question', error);
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
          }),
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

  async getDashboardStats(scope: SupportQueueScope, startDate?: Date, endDate?: Date) {
    try {
      const stats = await this.questionRepo.getStats({
        courseIds: scope.courseIds,
        startDate,
        endDate,
      });

      const ratedQuestions = await this.questionRepo.findForAdmin({
        statuses: [SupportQuestionStatus.ANSWERED, SupportQuestionStatus.RESOLVED],
        courseIds: scope.courseIds,
        limit: RATING_SAMPLE_LIMIT,
      });

      const helpfulCount = ratedQuestions.filter((q) => q.resolutionRating === 'helpful').length;
      const totalRated = ratedQuestions.filter((q) => q.resolutionRating).length;
      const satisfactionRate = totalRated > 0 ? (helpfulCount / totalRated) * 100 : 0;

      return {
        totalQuestions: stats.total,
        pending: stats.byStatus[SupportQuestionStatus.PENDING],
        answered: stats.byStatus[SupportQuestionStatus.ANSWERED],
        resolved: stats.byStatus[SupportQuestionStatus.RESOLVED],
        escalated: stats.byStatus[SupportQuestionStatus.ESCALATED],
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
    faq: Omit<IFAQ, '_id' | 'createdAt' | 'updatedAt' | 'embedding' | 'createdBy'>,
    adminUserId: ObjectId
  ): Promise<IFAQ> {
    try {
      // undefined when the embedding provider is down; retrieval still matches
      // the FAQ lexically and backfills the vector on a later chat turn.
      const embedding = await this.faqRetrieval.generateEmbeddingForFAQ(faq);

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
