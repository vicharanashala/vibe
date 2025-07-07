import { injectable, inject } from 'inversify';
import { WebhookService } from './WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { JobBody } from '../classes/validators/GenAIValidators.js';
import { GenAIRepository } from '../repositories/providers/mongodb/GenAIRepository.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { NotFoundError } from 'routing-controllers';
import { TaskStatus, TaskType } from '../classes/transformers/GenAI.js';

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
    this._withTransaction( async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError("job with the given Id not found");
      }
      job._id = job._id.toString();
      return job;
    })
  }

  async getAllTasksStatus(jobId: string): Promise<any> {
    this._withTransaction(async session => {
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
  async updateJob(jobId: string, task: string, status: string, jobData?: any): Promise<any> {
    return this._withTransaction(async session => {
      // Retrieve existing job
      const job = await this.genAIRepository.getById(jobId, session);
      const taskData = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!job || !taskData) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      switch (task) {
        case TaskType.AUDIO_EXTRACTION:
          if (status === 'COMPLETED') {
            job.jobStatus.audioExtraction = TaskStatus.COMPLETED;
            if (taskData.audioExtraction) {
              taskData.audioExtraction.push({status: TaskStatus.COMPLETED, ...jobData});
            } else {
              taskData.audioExtraction = [{status: TaskStatus.COMPLETED, ...jobData}];
            }
          } else if (status === 'FAILED') {
            job.jobStatus.audioExtraction = TaskStatus.FAILED;
            if (taskData.audioExtraction) {
              taskData.audioExtraction.push({status: TaskStatus.FAILED});
            } else {
              taskData.audioExtraction = [{status: TaskStatus.FAILED}];
            }
          }
          break;
        case TaskType.TRANSCRIPT_GENERATION:
          if (status === 'COMPLETED') {
            job.jobStatus.transcriptGeneration = TaskStatus.COMPLETED;
            if (taskData.transcriptGeneration) {
              taskData.transcriptGeneration.push({status: TaskStatus.COMPLETED, ...jobData});
            } else {
              taskData.transcriptGeneration = [{status: TaskStatus.COMPLETED, ...jobData}];
            }
          } else if (status === 'FAILED') {
            job.jobStatus.transcriptGeneration = TaskStatus.FAILED;
            if (taskData.transcriptGeneration) {
              taskData.transcriptGeneration.push({status: TaskStatus.FAILED});
            } else {
              taskData.transcriptGeneration = [{status: TaskStatus.FAILED}];
            }
          }
          break;
        case TaskType.SEGMENTATION:
          if (status === 'COMPLETED') {
            job.jobStatus.segmentation = TaskStatus.COMPLETED;
            if (taskData.segmentation) {
              taskData.segmentation.push({status: TaskStatus.COMPLETED, ...jobData});
            } else {
              taskData.segmentation = [{status: TaskStatus.COMPLETED, ...jobData}];
            }
          } else if (status === 'FAILED') {
            job.jobStatus.segmentation = TaskStatus.FAILED;
            if (taskData.segmentation) {
              taskData.segmentation.push({status: TaskStatus.FAILED});
            } else {
              taskData.segmentation = [{status: TaskStatus.FAILED}];
            }
          }
          break;
        case TaskType.QUESTION_GENERATION:
          if (status === 'COMPLETED') {
            job.jobStatus.questionGeneration = TaskStatus.COMPLETED;
            if (taskData.questionGeneration) {
              taskData.questionGeneration.push({status: TaskStatus.COMPLETED, ...jobData});
            } else {
              taskData.questionGeneration = [{status: TaskStatus.COMPLETED, ...jobData}];
            }
          } else if (status === 'FAILED') {
            job.jobStatus.questionGeneration = TaskStatus.FAILED;
            if (taskData.questionGeneration) {
              taskData.questionGeneration.push({status: TaskStatus.FAILED});
            } else {
              taskData.questionGeneration = [{status: TaskStatus.FAILED}];
            }
          }
          break;
        case TaskType.UPLOAD_QUESTION:
          if (status === 'COMPLETED') {
            job.jobStatus.uploadQuestion = TaskStatus.COMPLETED;
          } else if (status === 'FAILED') {
            job.jobStatus.uploadQuestion = TaskStatus.FAILED;
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

  /**
   * Mark a job as complete
   * @param jobId The job ID
   * @param completionData Completion data
   * @returns Completed job information
   */
  async completeJob(jobId: string, completionData: any): Promise<any> {
    // In a real implementation, update database record
    // const job = await this.jobRepository.findById(jobId);
    // if (!job) {
    //   throw new NotFoundError(`Job with ID ${jobId} not found`);
    // }
    
    // Update job status to completed
    // job.status = 'COMPLETED';
    // job.completionData = completionData;
    // const completedJob = await this.jobRepository.save(job);
    
    // For now, just return the data
    return { ...completionData, jobId, status: 'COMPLETED' };
  }

  /**
   * Mark a job as failed
   * @param jobId The job ID
   * @param failureData Failure data
   * @returns Failed job information
   */
  async failJob(jobId: string, failureData: any): Promise<any> {
    // In a real implementation, update database record
    // const job = await this.jobRepository.findById(jobId);
    // if (!job) {
    //   throw new NotFoundError(`Job with ID ${jobId} not found`);
    // }
    
    // Update job status to failed
    // job.status = 'FAILED';
    // job.error = failureData.error;
    // const failedJob = await this.jobRepository.save(job);
    
    // For now, just return the data
    return { ...failureData, jobId, status: 'FAILED' };
  }
}