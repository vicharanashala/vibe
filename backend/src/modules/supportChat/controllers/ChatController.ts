import { inject, injectable } from 'inversify';
import {
  JsonController,
  Post,
  Get,
  Patch,
  Body,
  Params,
  QueryParams,
  Authorized,
  CurrentUser,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { ChatMessageResponse, SUPPORT_CHAT_TYPES } from '../types.js';
import { ChatService } from '../services/index.js';
import {
  ChatHistoryQuery,
  ChatMessageBody,
  ChatMessageQuery,
  EscalateQuestionBody,
  FAQSearchQuery,
  RateQuestionBody,
  SupportQuestionPathParams,
} from '../classes/validators/SupportChatValidators.js';

// The app mounts routing-controllers with routePrefix '/api', so the prefix is
// omitted here — declaring it would serve the routes at /api/api/support/chat.
@JsonController('/support/chat')
@injectable()
export class ChatController {
  constructor(@inject(SUPPORT_CHAT_TYPES.ChatService) private chatService: ChatService) {}

  @Post('/message')
  @Authorized()
  async sendMessage(
    @CurrentUser() user: any,
    @Body() messageRequest: ChatMessageBody,
    @QueryParams() query: ChatMessageQuery
  ): Promise<ChatMessageResponse> {
    const userId = new ObjectId(user.id);
    const courseId = query.courseId ? new ObjectId(query.courseId) : undefined;
    const courseVersionId = query.courseVersionId ? new ObjectId(query.courseVersionId) : undefined;
    const cohortId = query.cohortId ? new ObjectId(query.cohortId) : undefined;

    return this.chatService.handleUserQuestion(
      userId,
      {
        question: messageRequest.question,
        context: messageRequest.context
          ? {
              page: messageRequest.context.page,
              itemId: messageRequest.context.itemId
                ? new ObjectId(messageRequest.context.itemId)
                : undefined,
              module: messageRequest.context.module,
            }
          : undefined,
      },
      courseId,
      courseVersionId,
      cohortId
    );
  }

  @Get('/history')
  @Authorized()
  async getHistory(
    @CurrentUser() user: any,
    @QueryParams() query: ChatHistoryQuery
  ) {
    const userId = new ObjectId(user.id);
    const limit = query.limit ?? 50;

    const questions = await this.chatService.getQuestionHistory(userId, limit);

    return {
      questions,
      total: questions.length,
    };
  }

  @Get('/faqs/search')
  async searchFAQs(@QueryParams() query: FAQSearchQuery) {
    // This would be implemented with FAQ retrieval and search logic
    // For now, returning placeholder
    return {
      faqs: [],
      total: 0,
    };
  }

  @Get('/:questionId')
  @Authorized()
  async getQuestion(
    @CurrentUser() user: any,
    @Params() params: SupportQuestionPathParams
  ) {
    const qId = new ObjectId(params.questionId);
    const question = await this.chatService.getQuestion(qId);

    if (!question) {
      throw new NotFoundError('Question not found');
    }

    // Verify ownership
    if (question.userId.toString() !== user.id) {
      throw new ForbiddenError('Unauthorized');
    }

    return question;
  }

  @Patch('/:questionId/rate')
  @Authorized()
  async rateQuestion(
    @CurrentUser() user: any,
    @Params() params: SupportQuestionPathParams,
    @Body() body: RateQuestionBody
  ) {
    const qId2 = new ObjectId(params.questionId);
    await this.getOwnQuestion(qId2, user.id);

    return await this.chatService.rateResolution(qId2, body.rating);
  }

  /**
   * Files a technical-issue report against a question the bot could not
   * answer. The question row already exists — this attaches the detail the
   * learner had no way to give in a single chat turn.
   */
  @Post('/:questionId/escalate')
  @Authorized()
  async escalateQuestion(
    @CurrentUser() user: any,
    @Params() params: SupportQuestionPathParams,
    @Body() body: EscalateQuestionBody
  ) {
    const qId = new ObjectId(params.questionId);
    await this.getOwnQuestion(qId, user.id);

    return await this.chatService.escalateQuestion(qId, body);
  }

  /** Loads a question, refusing anything that is not the caller's own. */
  private async getOwnQuestion(questionId: ObjectId, userId: string) {
    const question = await this.chatService.getQuestion(questionId);

    if (!question) {
      throw new NotFoundError('Question not found');
    }

    if (question.userId.toString() !== userId) {
      throw new ForbiddenError('Unauthorized');
    }

    return question;
  }
}
