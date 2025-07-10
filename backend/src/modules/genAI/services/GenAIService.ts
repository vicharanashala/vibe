import { injectable, inject } from 'inversify';
import { WebhookService } from './WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { JobBody } from '../classes/validators/GenAIValidators.js';
import { GenAIRepository } from '../repositories/providers/mongodb/GenAIRepository.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { NotFoundError } from 'routing-controllers';
import { audioData, contentUploadData, questionGenerationData, segmentationData, TaskStatus, TaskType, trascriptGenerationData } from '../classes/transformers/GenAI.js';

@injectable()
export class GenAIService extends BaseService {
  constructor(
    @inject(GENAI_TYPES.WebhookService)
    private readonly webhookService: WebhookService,

    @inject(GENAI_TYPES.GenAIRepository)
    private readonly genAIRepository: GenAIRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  /**
   * Start a new genAI job
   * @param jobData Job configuration data
   * @returns Created job data
   */
  async startJob(userId: string, jobData: JobBody): Promise<{ jobId: string; result: string }> {
    return this._withTransaction(async session => {
      // Prepare job data and send to AI server]
      const jobId = await this.genAIRepository.save(userId, jobData, session)
      const result = await this.webhookService.sendJobToAiServer(jobData, userId, jobId);
      await this.genAIRepository.createTaskData(jobId, session);
      return {jobId, result};
    });
  }

  /**
   * Get job status by ID
   * @param jobId The job ID to retrieve status for
   * @returns Job status data
   */
  async getJobStatus(jobId: string): Promise<any> {
    return this._withTransaction( async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError("job with the given Id not found");
      }
      job._id = job._id.toString();
      return job;
    })
  }

  async getAllTasksStatus(jobId: string): Promise<any> {
    return this._withTransaction(async session => {
      const taskData = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!taskData) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      taskData._id = taskData._id.toString();
      return taskData;
    });
  }

  async getAllJobsData(userId: string): Promise<any> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getAllByUserId(userId, session);
      if (!job) {
        throw new NotFoundError(`No jobs found for user ID ${userId}`);
      }
      job.forEach(j => {
        j._id = j._id.toString();
      });
      return job;
    });
  }

  /**
   * Update job status based on webhook data
   * @param jobId The job ID
   * @param jobData Updated job data
   * @returns Updated job information
   */
  async updateJob(jobId: string, task: string, jobData?: audioData | trascriptGenerationData | segmentationData | questionGenerationData | contentUploadData): Promise<any> {
    return this._withTransaction(async session => {
      // Retrieve existing job
      const job = await this.genAIRepository.getById(jobId, session);
      const taskData = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!job || !taskData) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      switch (task) {
        case TaskType.AUDIO_EXTRACTION:
          job.jobStatus.audioExtraction = jobData.status;
          if (taskData.audioExtraction) {
              taskData.audioExtraction.push({...jobData as audioData});
            } else {
              taskData.audioExtraction = [{...jobData as audioData}];
            }
          break;
        case TaskType.TRANSCRIPT_GENERATION:
          job.jobStatus.transcriptGeneration = jobData.status;
          if (taskData.transcriptGeneration) {
            taskData.transcriptGeneration.push({...jobData as trascriptGenerationData});
          }
          else {
            taskData.transcriptGeneration = [{...jobData as trascriptGenerationData}];
          }
          break;
        case TaskType.SEGMENTATION:
          job.jobStatus.segmentation = jobData.status;
          if (taskData.segmentation) {
            taskData.segmentation.push({...jobData as segmentationData});
          } else {
            taskData.segmentation = [{...jobData as segmentationData}];
          }
          break;
        case TaskType.QUESTION_GENERATION:
          job.jobStatus.questionGeneration = jobData.status;
          if (taskData.questionGeneration) {
            taskData.questionGeneration.push({...jobData as questionGenerationData});
          } else {
            taskData.questionGeneration = [{...jobData as questionGenerationData}];
          }
          break;
        case TaskType.UPLOAD_CONTENT:
          job.jobStatus.uploadContent = jobData.status;
          if (taskData.uploadContent) {
            taskData.uploadContent.push({...jobData as contentUploadData});
          } else {
            taskData.uploadContent = [{...jobData as contentUploadData}];
          }
          break;
      }
      // Update job and task data
      const updatedJob = await this.genAIRepository.update(jobId, job, session);
      const updatedTaskData = await this.genAIRepository.updateTaskData(jobId, taskData, session);
      if (!updatedJob || !updatedTaskData) {
        throw new NotFoundError(`Failed to update job or task data for job ID ${jobId}`);
      }
    });
  }

  async getJobState(jobId: string): Promise<any> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      job._id = job._id.toString();
      const task = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      
    });
  }
}