import { injectable, inject } from 'inversify';
import { 
  Body, 
  HeaderParam,
  JsonController, 
  Post,
  HttpCode,
  BadRequestError,
  UnauthorizedError,
  OnUndefined
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { WebhookService } from '../services/WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { GenAIService } from '../services/GenAIService.js';
import { WebhookBody } from '../classes/validators/GenAIValidators.js';

@OpenAPI({
  tags: ['Webhook'],
  description: 'Webhook endpoints for AI server communication',
  security: [{ apiKey: [] }]
})
@injectable()
@JsonController('/genAI/webhook')
export class WebhookController {
  constructor(
    @inject(GENAI_TYPES.WebhookService)
    private readonly webhookService: WebhookService,
    
    @inject(GENAI_TYPES.GenAIService)
    private readonly genAIService: GenAIService
  ) {}

  @Post('/')
  @OnUndefined(200)
  async handleWebhook(
    @HeaderParam('x-webhook-signature') signature: string,
    @Body() body: WebhookBody,
  ) {
    // Verify webhook signature
    console.log('Received webhook with signature:', signature);
    if (!this.webhookService.verifyWebhookSignature(signature)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    const { task, status, jobId, data } = body;

    await this.genAIService.updateJob(jobId, task, status, data);
  }
}