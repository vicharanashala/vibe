import { inject, injectable } from 'inversify';
import { ObjectId } from 'mongodb';
import {
  ChatMessageResponse,
  EscalateQuestionRequest,
  ISupportQuestion,
  SupportQuestionStatus,
  SUPPORT_CHAT_TYPES,
  ChatMessageRequest,
  SUPPORT_CHAT_AI_CONFIG,
} from '../types.js';
import { FAQRetrievalService } from './FAQRetrievalService.js';
import {SupportAnswerGenerator} from './SupportAnswerGenerator.js';
import { FAQRepository } from '../repositories/providers/mongodb/index.js';
import { SupportQuestionRepository } from '../repositories/providers/mongodb/index.js';

const ESCALATION_MESSAGE =
  "I'm not sure about that. Let me connect you with our support team. They'll review your question and get back to you soon.";

@injectable()
export class ChatService {

  constructor(
    @inject(SUPPORT_CHAT_TYPES.FAQRetrievalService) private faqRetrieval: FAQRetrievalService,
    @inject(SUPPORT_CHAT_TYPES.FAQRepo) private faqRepo: FAQRepository,
    @inject(SUPPORT_CHAT_TYPES.SupportQuestionRepo)
    private questionRepo: SupportQuestionRepository,
    // Optional so the service still works, FAQ-only, where no generator is wired.
    @inject(SUPPORT_CHAT_TYPES.SupportAnswerGenerator)
    private answerGenerator?: SupportAnswerGenerator,
  ) {}

  async handleUserQuestion(
    userId: ObjectId,
    messageRequest: ChatMessageRequest,
    courseId?: ObjectId,
    courseVersionId?: ObjectId,
    cohortId?: ObjectId
  ): Promise<ChatMessageResponse> {
    try {
      // Create question record
      const question = await this.questionRepo.create({
        userId,
        courseId,
        courseVersionId,
        cohortId,
        question: messageRequest.question,
        context: messageRequest.context,
        status: SupportQuestionStatus.PENDING,
        learnersSeenResponse: false,
      });

      // Try to retrieve matching FAQ
      const retrievalResult = await this.faqRetrieval.retrieveFAQ(messageRequest.question);

      if (retrievalResult) {
        // Update question with FAQ match
        await this.questionRepo.setFaqMatch(
          question._id!,
          retrievalResult.faq._id!,
          retrievalResult.score
        );

        // Increment FAQ usage count
        await this.faqRepo.incrementUsageCount(retrievalResult.faq._id!);

        return {
          response: retrievalResult.faq.answer,
          confidence: retrievalResult.score,
          faqId: retrievalResult.faq._id,
          isFromFAQ: true,
          isEscalated: false,
          questionId: question._id!,
          source: `From our FAQ (Added on ${retrievalResult.faq.createdAt.toLocaleDateString()})`,
        };
      }

      // No confident FAQ match. Before escalating, let the model try to answer
      // from the FAQs — most misses are the right FAQ asked in other words.
      const aiAnswer = await this.tryAIAnswer(messageRequest.question);

      if (aiAnswer) {
        const primaryFaq = aiAnswer.faqs[0];
        await this.questionRepo.setAIAnswer(
          question._id!,
          primaryFaq._id!,
          aiAnswer.answer,
        );
        await this.faqRepo.incrementUsageCount(primaryFaq._id!);

        return {
          response: aiAnswer.answer,
          confidence: 0,
          faqId: primaryFaq._id,
          isFromFAQ: false,
          isAIGenerated: true,
          isEscalated: false,
          questionId: question._id!,
          source: `AI answer based on our FAQ: "${primaryFaq.question}"`,
        };
      }

      // Nothing to answer from - escalate to admin. The status has to be
      // persisted, not just reported in the response, or the question is
      // indistinguishable from an answered one in the admin queue.
      await this.questionRepo.updateStatus(question._id!, SupportQuestionStatus.ESCALATED);

      return {
        response: ESCALATION_MESSAGE,
        confidence: 0,
        isFromFAQ: false,
        isEscalated: true,
        questionId: question._id!,
      };
    } catch (error) {
      console.error('Error handling user question', error);
      throw error;
    }
  }

  /** A grounded model answer, or null to escalate. Never throws. */
  private async tryAIAnswer(question: string) {
    if (!this.answerGenerator?.isAvailable()) return null;

    try {
      const {maxContextFaqs, maxContextChars} = SUPPORT_CHAT_AI_CONFIG;
      const candidates = await this.faqRetrieval.rankForContext(
        question,
        maxContextFaqs,
        maxContextChars,
      );
      return await this.answerGenerator.generate(question, candidates);
    } catch (error) {
      console.error('AI fallback failed, escalating', error);
      return null;
    }
  }

  async getQuestionHistory(userId: ObjectId, limit: number = 50): Promise<ISupportQuestion[]> {
    try {
      return await this.questionRepo.findByUserId(userId, limit);
    } catch (error) {
      console.error('Error fetching question history', error);
      throw error;
    }
  }

  async getQuestion(questionId: ObjectId): Promise<ISupportQuestion | null> {
    try {
      return await this.questionRepo.findById(questionId);
    } catch (error) {
      console.error('Error fetching question', error);
      throw error;
    }
  }

  /**
   * Attaches the learner's technical-issue report to a question the bot could
   * not answer. Deliberately idempotent — a learner who edits and resubmits
   * replaces the report rather than opening a second ticket.
   */
  async escalateQuestion(
    questionId: ObjectId,
    request: EscalateQuestionRequest
  ): Promise<ISupportQuestion | null> {
    try {
      return await this.questionRepo.setEscalation(questionId, {
        category: request.category,
        details: request.details,
        contactEmail: request.contactEmail,
        submittedAt: new Date(),
      });
    } catch (error) {
      console.error('Error escalating question', error);
      throw error;
    }
  }

  async rateResolution(
    questionId: ObjectId,
    rating: 'helpful' | 'not_helpful'
  ): Promise<ISupportQuestion | null> {
    try {
      const updated = await this.questionRepo.setResolutionRating(questionId, rating);
      console.log(`Question ${questionId} rated as ${rating}`);
      return updated;
    } catch (error) {
      console.error('Error rating resolution', error);
      throw error;
    }
  }
}
