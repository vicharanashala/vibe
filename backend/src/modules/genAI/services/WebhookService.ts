import { injectable } from 'inversify';
import axios, { AxiosInstance } from 'axios';
import { JobState } from '../classes/transformers/GenAI.js';
import { aiConfig } from '#root/config/ai.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { appConfig } from '#root/config/index.js';

@injectable()
export class WebhookService {
  private readonly httpClient: AxiosInstance;
  private readonly aiServerUrl: string;
  
  constructor() {
    this.aiServerUrl = 'http://' + aiConfig.serverIP + ':' + aiConfig.serverPort;

    const agent = appConfig.isProduction || appConfig.isStaging ? new SocksProxyAgent(aiConfig.proxyAddress) : undefined;

    this.httpClient = axios.create({
      httpAgent: agent,
      httpsAgent: agent,
      baseURL: this.aiServerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  /**
   * Send job to AI server for processing
   * @param jobData The job data to be processed
   * @returns Job ID and status from AI server
   */
  async AIServerCheck(): Promise<number> {
    const response = await this.httpClient.get('/');
    return response.status;
  }

  /**
   * Approve task to start on AI server
   * @param jobId The job ID
   * @param taskParams Parameters for the task
   * @returns Updated job data from AI server
   */
  async approveTaskStart(jobId: string, jobState: JobState): Promise<any> {
    console.log(jobState);
    const response = await this.httpClient.post(`/jobs/${jobId}/tasks/approve/start`, jobState);
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
   * Request to rerun current task on AI server
   * @param jobId The job ID
   * @returns Updated job data from AI server
   */
  async rerunTask(jobId: string, jobState: JobState): Promise<any> {
    console.log(jobState);
    const response = await this.httpClient.post(`/jobs/${jobId}/tasks/rerun`, jobState);
    return response.data;
  }

  async abortTask(jobId: string) {
    const response = await this.httpClient.post(`/jobs/${jobId}/abort`);
    if (response.status !== 200) {
      throw new Error(`Failed to abort task for job ID ${jobId}`);
    }
    return response.data;
  }
}