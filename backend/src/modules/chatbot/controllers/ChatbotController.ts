import { injectable, inject } from 'inversify';
import {
  Body,
  JsonController,
  Post,
  HttpCode,
  Authorized,
  CurrentUser,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { ChatbotQueryBody, ChatbotResponse } from '../classes/validators/ChatbotValidators.js';
import { ChatbotService } from '../services/ChatbotService.js';
import { CHATBOT_TYPES } from '../types.js';
import { BadRequestErrorResponse } from '#root/shared/index.js';
import { IUser } from '#root/shared/interfaces/models.js';

@OpenAPI({
  tags: ['Chatbot'],
  description: 'Operations for chatbot interactions',
})
@injectable()
@JsonController('/chatbot')
export class ChatbotController {
  constructor(
    @inject(CHATBOT_TYPES.ChatbotService)
    private readonly chatbotService: ChatbotService,
  ) {}

  @OpenAPI({
    summary: 'Query the enrollment-scoped chatbot',
    description: 'Returns an AI-generated answer to a course question, scoped strictly to the student\'s active enrollments.',
  })
  @Post('/query')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(ChatbotResponse, {
    description: 'Chatbot response generated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async query(
    @Body() body: ChatbotQueryBody,
    @CurrentUser({ required: true }) user: IUser,
  ): Promise<ChatbotResponse> {
    const responseText = await this.chatbotService.query(user, body.question);
    return { response: responseText };
  }
}
