import { injectable } from 'inversify';
import axios, { AxiosInstance } from 'axios';
import { appConfig } from '#root/config/app.js';
import { TranscriptParameters, SegmentationParameters, QuestionGenerationParameters } from '../classes/transformers/GenAI.js';

@injectable()
export class WebhookService {
  private readonly httpClient: AxiosInstance;
  private readonly aiServerUrl: string;
  private readonly webhookSecret: string;
  
  constructor() {
    this.aiServerUrl = appConfig.aiServer.url;
    this.webhookSecret = appConfig.aiServer.webhookSecret;
    
    this.httpClient = axios.create({
      baseURL: this.aiServerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': this.webhookSecret
      }
    });
  }

  /**
   * Send job to AI server for processing
   * @param jobData The job data to be processed
   * @returns Job ID and status from AI server
   */
  async sendJobToAiServer(jobData: any, userId: string, jobId: string): Promise<string> {
    const webhookUrl = `${appConfig.url}${appConfig.routePrefix}/genai/webhook`;
    const payload = {
      data: jobData,
      userId,
      jobId,
      webhookUrl,
      webhookSecret: this.webhookSecret
    };
    
    const response = await this.httpClient.post('/jobs', payload);
    return response.data;
  }

  /**
   * Approve task to start on AI server
   * @param jobId The job ID
   * @param taskParams Parameters for the task
   * @returns Updated job data from AI server
   */
  async approveTaskStart(jobId: string, taskParams: TranscriptParameters | SegmentationParameters | QuestionGenerationParameters): Promise<any> {
    const response = await this.httpClient.post(`/jobs/${jobId}/tasks/approve/start`, taskParams);
    return response.data;
  }

  /**
   * Approve task completion and continue to next task on AI server
   * @param jobId The job ID
   * @param approvalData Approval data for the task
   * @returns Updated job data from AI server
   */
  async approveTaskContinue(jobId: string): Promise<any> {
    const response = await this.httpClient.post(`/jobs/${jobId}/tasks/approve/continue`);
    return response.data;
  }

  /**
   * Abort job on AI server
   * @param jobId The job ID to abort
   * @returns Updated job data from AI server
   */
  async abortJob(jobId: string): Promise<any> {
    const response = await this.httpClient.post(`/jobs/${jobId}/abort`);
    return response.data;
  }

  /**
   * Request to rerun current task on AI server
   * @param jobId The job ID
   * @returns Updated job data from AI server
   */
  async rerunTask(jobId: string, taskParams: TranscriptParameters | SegmentationParameters | QuestionGenerationParameters): Promise<any> {
    const response = await this.httpClient.post(`/jobs/${jobId}/tasks/rerun`, taskParams);
    return response.data;
  }

  /**
   * Verify webhook signature from AI server
   * @param signature The signature from request headers
   * @param body The request body
   * @returns Boolean indicating if signature is valid
   */
  verifyWebhookSignature(signature: string): boolean {
    if (!signature) {
      return false;
    }
    
    // Simple signature verification
    return signature === this.webhookSecret;
  }
}