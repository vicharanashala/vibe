import { inject, injectable } from 'inversify';
import {
  controller,
  httpPost,
  httpGet,
  httpPatch,
  requestBody,
  pathParams,
  queryParams,
} from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { ChatMessageRequest, ChatMessageResponse, SUPPORT_CHAT_TYPES } from '../types';
import { ChatService } from '../services';
import { Authorized, CurrentUser } from '@/shared/decorators';

@controller('/api/support/chat')
@injectable()
export class ChatController {
  constructor(@inject(SUPPORT_CHAT_TYPES.ChatService) private chatService: ChatService) {}

  @httpPost('/message')
  @Authorized('user')
  async sendMessage(
    @CurrentUser() user: any,
    @requestBody() messageRequest: ChatMessageRequest,
    @queryParams() query: { courseId?: string; courseVersionId?: string; cohortId?: string }
  ): Promise<ChatMessageResponse> {
    const userId = new ObjectId(user.id);
    const courseId = query.courseId ? new ObjectId(query.courseId) : undefined;
    const courseVersionId = query.courseVersionId ? new ObjectId(query.courseVersionId) : undefined;
    const cohortId = query.cohortId ? new ObjectId(query.cohortId) : undefined;

    return this.chatService.handleUserQuestion(
      userId,
      messageRequest,
      courseId,
      courseVersionId,
      cohortId
    );
  }

  @httpGet('/history')
  @Authorized('user')
  async getHistory(
    @CurrentUser() user: any,
    @queryParams() query: { limit?: string }
  ) {
    const userId = new ObjectId(user.id);
    const limit = query.limit ? parseInt(query.limit, 10) : 50;

    const questions = await this.chatService.getQuestionHistory(userId, limit);

    return {
      questions,
      total: questions.length,
    };
  }

  @httpGet('/:questionId')
  @Authorized('user')
  async getQuestion(
    @CurrentUser() user: any,
    @pathParams() params: { questionId: string }
  ) {
    const questionId = new ObjectId(params.questionId);
    const question = await this.chatService.getQuestion(questionId);

    if (!question) {
      throw new Error('Question not found');
    }

    // Verify ownership
    if (question.userId.toString() !== user.id) {
      throw new Error('Unauthorized');
    }

    return question;
  }

  @httpPatch('/:questionId/rate')
  @Authorized('user')
  async rateQuestion(
    @CurrentUser() user: any,
    @pathParams() params: { questionId: string },
    @requestBody() body: { rating: 'helpful' | 'not_helpful' }
  ) {
    const questionId = new ObjectId(params.questionId);
    const question = await this.chatService.getQuestion(questionId);

    if (!question) {
      throw new Error('Question not found');
    }

    // Verify ownership
    if (question.userId.toString() !== user.id) {
      throw new Error('Unauthorized');
    }

    return await this.chatService.rateResolution(questionId, body.rating);
  }

  @httpGet('/faqs/search')
  async searchFAQs(@queryParams() query: { search?: string; category?: string }) {
    // This would be implemented with FAQ retrieval and search logic
    // For now, returning placeholder
    return {
      faqs: [],
      total: 0,
    };
  }
}
