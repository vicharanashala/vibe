import { injectable, inject } from 'inversify';
import { 
  Body,
  JsonController, 
  Post,
  HttpCode,
  BadRequestError,
  OnUndefined,
  Get,
  Param
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { WebhookService } from '../services/WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { GenAIService } from '../services/GenAIService.js';
import { WebhookBody } from '../classes/validators/GenAIValidators.js';
import { SseService } from '../services/sseService.js';

@OpenAPI({
  tags: ['Webhook'],
  description: 'Webhook endpoints for AI server communication',
  security: [{ apiKey: [] }]
})
@injectable()
@JsonController('/genAI/webhook')
export class WebhookController {
  constructor(    
    @inject(GENAI_TYPES.GenAIService)
    private readonly genAIService: GenAIService,

    @inject(GENAI_TYPES.SseService)
    private readonly sseService: SseService
  ) {}

  @Post('/')
  @OnUndefined(200)
  async handleWebhook(
    @Body() body: WebhookBody,
  ) {
    const { task, jobId, data } = body;
    console.log('Webhook body:', body);
    // send sse event to clients
    this.sseService.send(jobId, 'jobStatus', { task, ...data });
    await this.genAIService.updateJob(jobId, task, data);
  }

  @Get('/job/:jobId')
  @HttpCode(200)
  async getJobStatus(
    @Param('jobId') jobId: string
  ) {
    if (!jobId) {
      throw new BadRequestError('Job ID is required');
    }
    const jobStatus = await this.genAIService.getJobState(jobId);
    return jobStatus;
  }
}