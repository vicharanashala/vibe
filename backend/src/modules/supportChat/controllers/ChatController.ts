import { inject, injectable } from 'inversify';
import {
  JsonController,
  Post,
  Get,
  Patch,
  Body,
  Param,
  QueryParams,
  Authorized,
  CurrentUser,
} from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { ChatMessageRequest, ChatMessageResponse, SUPPORT_CHAT_TYPES } from '../types.js';
import { ChatService } from '../services/index.js';

@JsonController('/api/support/chat')
@injectable()
export class ChatController {
  constructor(@inject(SUPPORT_CHAT_TYPES.ChatService) private chatService: ChatService) {}

  @Post('/message')
  @Authorized('user')
  async sendMessage(
    @CurrentUser() user: any,
    @Body() messageRequest: ChatMessageRequest,
    @QueryParams() query: { courseId?: string; courseVersionId?: string; cohortId?: string }
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

  @Get('/history')
  @Authorized('user')
  async getHistory(
    @CurrentUser() user: any,
    @QueryParams() query: { limit?: string }
  ) {
    const userId = new ObjectId(user.id);
    const limit = query.limit ? parseInt(query.limit, 10) : 50;

    const questions = await this.chatService.getQuestionHistory(userId, limit);

    return {
      questions,
      total: questions.length,
    };
  }

  @Get('/:questionId')
  @Authorized('user')
  async getQuestion(
    @CurrentUser() user: any,
    @Param('questionId') questionId: string
  ) {
    const qId = new ObjectId(questionId);
    const question = await this.chatService.getQuestion(qId);

    if (!question) {
      throw new Error('Question not found');
    }

    // Verify ownership
    if (question.userId.toString() !== user.id) {
      throw new Error('Unauthorized');
    }

    return question;
  }

  @Patch('/:questionId/rate')
  @Authorized('user')
  async rateQuestion(
    @CurrentUser() user: any,
    @Param('questionId') questionId: string,
    @Body() body: { rating: 'helpful' | 'not_helpful' }
  ) {
    const qId2 = new ObjectId(questionId);
    const question = await this.chatService.getQuestion(qId2);

    if (!question) {
      throw new Error('Question not found');
    }

    // Verify ownership
    if (question.userId.toString() !== user.id) {
      throw new Error('Unauthorized');
    }

    return await this.chatService.rateResolution(qId2, body.rating);
  }

  @Get('/faqs/search')
  async searchFAQs(@queryParams() query: { search?: string; category?: string }) {
    // This would be implemented with FAQ retrieval and search logic
    // For now, returning placeholder
    return {
      faqs: [],
      total: 0,
    };
  }
}
