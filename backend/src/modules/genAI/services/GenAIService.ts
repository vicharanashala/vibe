import { injectable, inject } from 'inversify';
import { WebhookService } from './WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { JobBody } from '../classes/validators/GenAIValidators.js';
import { GenAIRepository } from '../repositories/providers/mongodb/GenAIRepository.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ItemType, MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { BadRequestError, InternalServerError, NotFoundError } from 'routing-controllers';
import { audioData, contentUploadData, GenAIBody, JobState, JobStatus, questionGenerationData, QuestionGenerationParameters, segmentationData, SegmentationParameters, TaskData, TaskStatus, TaskType, TranscriptParameters, trascriptGenerationData, UploadParameters } from '../classes/transformers/GenAI.js';
import { QuestionFactory } from '#root/modules/quizzes/classes/index.js';
import { CreateItemBody } from '#root/modules/courses/classes/index.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';
import { ItemService } from '#root/modules/courses/services/ItemService.js';
import { QuestionBank } from '#root/modules/quizzes/classes/transformers/QuestionBank.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { QuestionBankService, QuizService } from '#root/modules/quizzes/services/index.js';
import { QuestionService } from '#root/modules/quizzes/services/QuestionService.js';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig } from '#root/config/ai.js';
import { appConfig } from '#root/config/app.js';
import { ANOMALIES_TYPES } from '#root/modules/anomalies/types.js';
import { CloudStorageService } from '#root/modules/anomalies/index.js';
import { storageConfig } from '#root/config/storage.js';

@injectable()
export class GenAIService extends BaseService {
  constructor(
    @inject(GENAI_TYPES.WebhookService)
    private readonly webhookService: WebhookService,

    @inject(GENAI_TYPES.GenAIRepository)
    private readonly genAIRepository: GenAIRepository,

    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,

    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,

    @inject(QUIZZES_TYPES.QuestionService)
    private readonly questionService: QuestionService,

    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,

    @inject(ANOMALIES_TYPES.CloudStorageService)
    private readonly cloudStorageService: CloudStorageService,

    private storage = new Storage({
      projectId: appConfig.firebase.projectId,
    })
  ) {
    super(mongoDatabase);
  }

  /**
   * Start a new genAI job
   * @param jobData Job configuration data
   * @returns Created job data
   */
  async startJob(userId: string, jobData: JobBody, audio?: Express.Multer.File): Promise<{ jobId: string }> {
    return this._withTransaction(async session => {

      // Prepare job data and send to AI server]
      const result = await this.webhookService.AIServerCheck();
      if (result !== 200) {
        throw new Error('Failed to connect to AI server');
      }
      const jobId = await this.genAIRepository.save(userId, jobData, audio? true : false, jobData.transcript ? true : false, session)
      if (audio) {
        // check file type (audio/)
        if (!audio.mimetype.startsWith('audio/')) {
          throw new BadRequestError('Invalid file type. Please upload an audio file.');
        }
        // store on buckets
        const fileName = await this.cloudStorageService.uploadAudio(audio, jobId);
        await this.genAIRepository.createTaskDataWithAudio(jobId, fileName, `https://storage.googleapis.com/${storageConfig.googleCloud.aiServerBucketName}/${fileName}`, session);
      }
      else if (jobData.transcript) {
        const fileName = await this.cloudStorageService.uploadTranscript(jobData.transcript, jobId);
        await this.genAIRepository.createTaskDataWithTranscript(jobId, fileName, `https://storage.googleapis.com/${storageConfig.googleCloud.aiServerBucketName}/${fileName}`, session);
      }
      else {
        await this.genAIRepository.createTaskData(jobId, session);
      }

      return {jobId};
    });
  }

  async abortTask(jobId: string): Promise<void> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      
      // Check which task is currently running
      let runningTask: TaskType | null = null;
      
      if (job.jobStatus.audioExtraction === TaskStatus.RUNNING) {
        runningTask = TaskType.AUDIO_EXTRACTION;
      } else if (job.jobStatus.transcriptGeneration === TaskStatus.RUNNING) {
        runningTask = TaskType.TRANSCRIPT_GENERATION;
      } else if (job.jobStatus.segmentation === TaskStatus.RUNNING) {
        runningTask = TaskType.SEGMENTATION;
      } else if (job.jobStatus.questionGeneration === TaskStatus.RUNNING) {
        runningTask = TaskType.QUESTION_GENERATION;
      } else if (job.jobStatus.uploadContent === TaskStatus.RUNNING) {
        runningTask = TaskType.UPLOAD_CONTENT;
      }
      
      if (!runningTask) {
        throw new BadRequestError(`No running tasks found for job ID ${jobId}`);
      }
      
      if (runningTask === TaskType.UPLOAD_CONTENT) {
        throw new InternalServerError("Task upload content cannot be aborted");
      }
      
      await this.webhookService.abortTask(jobId);
      await this.updateJob(jobId, runningTask, {
        status: TaskStatus.ABORTED,
        error: 'Task aborted by user'
      });
    });
  }

  removeUndefined(obj: any) {
    if (!obj) return null;
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
  }

  async approveTaskToStart(jobId: string, userId: string, usePrevious?: number, parameters?: Partial<TranscriptParameters | SegmentationParameters | QuestionGenerationParameters | UploadParameters>): Promise<any> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      if (job.userId !== userId) {
        throw new NotFoundError(`User with ID ${userId} does not have permission to approve this job`);
      }
      const jobState = await this.getJobState(jobId, usePrevious);
      jobState.parameters = {...jobState.parameters, ...this.removeUndefined(parameters)};
      if (jobState.taskStatus == TaskStatus.COMPLETED) {
        throw new BadRequestError(`The task ${jobState.currentTask} for job ID ${jobId} is already completed, you can either rerun the task or approve to move to the next taask.`);
      }
      if (jobState.currentTask === TaskType.UPLOAD_CONTENT) {
        const result =  await this.uploadContent(jobId, jobState);
        console.log(result);
        return result;
      }
      return this.webhookService.approveTaskStart(jobId, jobState);
    });
  }

  async rerunTask(jobId: string, userId: string, usePrevious?: number, parameters?: Partial<TranscriptParameters | SegmentationParameters | QuestionGenerationParameters | UploadParameters>): Promise<any> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      if (job.userId !== userId) {
        throw new NotFoundError(`User with ID ${userId} does not have permission to approve this job`);
      }
      const jobState = await this.getJobState(jobId, usePrevious);
      if (jobState.taskStatus !== TaskStatus.COMPLETED && jobState.taskStatus !== TaskStatus.FAILED && jobState.taskStatus !== TaskStatus.ABORTED) {
        throw new BadRequestError(`The task ${jobState.currentTask} for job ID ${jobId} has not been completed yet, please approve the task to start.`);
      }
      jobState.parameters = {...jobState.parameters, ...this.removeUndefined(parameters)};
      if (jobState.currentTask === TaskType.UPLOAD_CONTENT) {
        const result =  await this.uploadContent(jobId, jobState);
        console.log(result);
        return result;
      }
      return this.webhookService.rerunTask(jobId, jobState);
    });
  }

  async approveTaskContinue(jobId: string): Promise<void> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      if (job.jobStatus.uploadContent === TaskStatus.COMPLETED) {
        console.log(`Job completed successfully.`);
      } else if (job.jobStatus.questionGeneration === TaskStatus.COMPLETED) {
        job.jobStatus.uploadContent = TaskStatus.WAITING;
      } else if (job.jobStatus.segmentation === TaskStatus.COMPLETED) {
        job.jobStatus.questionGeneration = TaskStatus.WAITING;
      } else if (job.jobStatus.transcriptGeneration === TaskStatus.COMPLETED) {
        job.jobStatus.segmentation = TaskStatus.WAITING;
      } else if (job.jobStatus.audioExtraction === TaskStatus.COMPLETED) {
        job.jobStatus.transcriptGeneration = TaskStatus.WAITING;
      } else {
        throw new NotFoundError(`No active tasks found for job ID ${jobId}`);
      }
      const updatedJob = await this.genAIRepository.update(jobId, job, session);
      if (!updatedJob) {
        throw new InternalServerError(`Failed to update job with ID ${jobId}`);
      }
    })
  }

  /**
   * Get job status by ID
   * @param jobId The jobjobState ID to retrieve status for
   * @returns Job status data
   */
  async getJobStatus(jobId: string): Promise<GenAIBody> {
    return this._withTransaction( async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError("job with the given Id not found");
      }
      job._id = job._id.toString();
      return job;
    })
  }

  /**
   * Get task status by job ID and task type
   * @param jobId The job ID to retrieve task status for
   * @param type The type of task to retrieve status for
   * @returns Task status data
   */
  async getTaskStatus(jobId: string, type: TaskType): Promise<audioData[] | trascriptGenerationData[] | segmentationData[] | questionGenerationData[] | contentUploadData[]> {
    return this._withTransaction(async session => {
      const taskData = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!taskData) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      switch (type) {
        case TaskType.AUDIO_EXTRACTION:
          return taskData.audioExtraction;
        case TaskType.TRANSCRIPT_GENERATION:
          return taskData.transcriptGeneration;
        case TaskType.SEGMENTATION:
          return taskData.segmentation;
        case TaskType.QUESTION_GENERATION:
          return taskData.questionGeneration;
        case TaskType.UPLOAD_CONTENT:
          return taskData.uploadContent;
        default:
          throw new BadRequestError(`Invalid task type: ${type}`);
      }
    });
  }

  async editSegmentMap(jobId: string, segmentMap: Array<number>, index: number): Promise<void> {
    return this._withTransaction(async session => {
      const task = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      task.segmentation[index].segmentationMap = segmentMap;
      const updatedTask = await this.genAIRepository.updateTaskData(jobId, task, session);
      if (!updatedTask) {
        throw new InternalServerError(`Failed to update task for job ID ${jobId}`);
      }
    });
  }
  async editQuestionData(jobId: string, questionData: JSON, index: number): Promise<void> {
    return this._withTransaction(async session => {
      const task = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      const fileName = task.questionGeneration[index].fileName;
      let newFileName: string;
      if (/_updated(?:_\d+)?\.json$/.test(fileName)) {
        newFileName = fileName.replace(/_updated(?:_(\d+))?\.json$/, (match, p1) => {
          const nextNum = p1 ? parseInt(p1, 10) + 1 : 1;
          return `_updated_${nextNum}.json`;
        });
      } else {
        newFileName = fileName.replace(/\.json$/, '_updated.json');
      }
      const data = JSON.stringify(questionData);
      await this.storage.bucket(appConfig.firebase.storageBucket).file(newFileName).save(Buffer.from(data), { contentType: 'application/json', });
      task.questionGeneration[index].fileName = newFileName;
      task.questionGeneration[index].fileUrl = `https://storage.googleapis.com/${appConfig.firebase.storageBucket}/${newFileName}`;
      await this.genAIRepository.updateTaskData(jobId, task, session);
    });
  }
  async editTranscript(jobId: string, transcript: JSON, index: number): Promise<void> {
    return this._withTransaction(async session => {
      const task = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      const fileName = task.transcriptGeneration[index].fileName;
      let newFileName: string;
      if (/_updated(?:_\d+)?\.json$/.test(fileName)) {
        newFileName = fileName.replace(/_updated(?:_(\d+))?\.json$/, (match, p1) => {
          const nextNum = p1 ? parseInt(p1, 10) + 1 : 1;
          return `_updated_${nextNum}.json`;
        });
      } else {
        newFileName = fileName.replace(/\.json$/, '_updated.json');
      }
      const data = JSON.stringify(transcript);
      await this.storage.bucket(appConfig.firebase.storageBucket).file(newFileName).save(Buffer.from(data), { contentType: 'application/json', });
      task.transcriptGeneration[index].fileName = newFileName;
      task.transcriptGeneration[index].fileUrl = `https://storage.googleapis.com/${appConfig.firebase.storageBucket}/${newFileName}`;
      await this.genAIRepository.updateTaskData(jobId, task, session);
    });
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
    console.log(`Updating job ${jobId} for task ${task} with data:`, jobData);
    return this._withTransaction(async session => {
      // Retrieve existing job
      const job = await this.genAIRepository.getById(jobId, session);
      const taskData = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!job || !taskData) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      if (jobData.status === TaskStatus.COMPLETED || jobData.status === TaskStatus.FAILED || jobData.status === TaskStatus.ABORTED) {
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
        }
      } else {
        switch (task) {
          case TaskType.AUDIO_EXTRACTION:
            job.jobStatus.audioExtraction = jobData.status;
            break;
          case TaskType.TRANSCRIPT_GENERATION:
            job.jobStatus.transcriptGeneration = jobData.status;
            break;
          case TaskType.SEGMENTATION:
            job.jobStatus.segmentation = jobData.status;
            break;
          case TaskType.QUESTION_GENERATION:
            job.jobStatus.questionGeneration = jobData.status;
            break;
        }
      }
      // Update job and task data
      const updatedJob = await this.genAIRepository.update(jobId, job, session);
      const updatedTaskData = await this.genAIRepository.updateTaskData(jobId, taskData, session);
      if (!updatedJob || !updatedTaskData) {
        throw new NotFoundError(`Failed to update job or task data for job ID ${jobId}`);
      }
    });
  }

  async getJobState(jobId: string, usePrevious?: number): Promise<JobState> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      console.log(jobId, usePrevious)
      const task = await this.genAIRepository.getTaskDataByJobId(jobId, session);
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      const jobState = new JobState();
      if (!(job.jobStatus.audioExtraction === TaskStatus.PENDING || job.jobStatus.audioExtraction === TaskStatus.RUNNING)) {
        jobState.currentTask = TaskType.AUDIO_EXTRACTION;
        if (job.jobStatus.audioExtraction === TaskStatus.WAITING) jobState.currentTask = null;
        jobState.taskStatus = job.jobStatus.audioExtraction;
        jobState.url = job.url;
      }
      if (!(job.jobStatus.transcriptGeneration === TaskStatus.PENDING || job.jobStatus.transcriptGeneration === TaskStatus.RUNNING)) {
        jobState.currentTask = TaskType.TRANSCRIPT_GENERATION;
        if (job.jobStatus.transcriptGeneration === TaskStatus.WAITING) jobState.currentTask = TaskType.AUDIO_EXTRACTION;
        jobState.taskStatus = job.jobStatus.transcriptGeneration;
        jobState.parameters = job.transcriptParameters;
        jobState.file = task.audioExtraction[usePrevious ? usePrevious : task.audioExtraction.length - 1]?.fileUrl;
      }
      if (!(job.jobStatus.segmentation === TaskStatus.PENDING || job.jobStatus.segmentation === TaskStatus.RUNNING)) {
        jobState.currentTask = TaskType.SEGMENTATION;
        if (job.jobStatus.segmentation === TaskStatus.WAITING) jobState.currentTask = TaskType.TRANSCRIPT_GENERATION;
        jobState.taskStatus = job.jobStatus.segmentation;
        jobState.parameters = job.segmentationParameters;
        jobState.file = task.transcriptGeneration[usePrevious ? usePrevious : task.transcriptGeneration.length - 1]?.fileUrl;
      }
      if (!(job.jobStatus.questionGeneration === TaskStatus.PENDING || job.jobStatus.questionGeneration === TaskStatus.RUNNING)) {
        jobState.currentTask = TaskType.QUESTION_GENERATION;
        if (job.jobStatus.questionGeneration === TaskStatus.WAITING) jobState.currentTask = TaskType.SEGMENTATION;
        jobState.taskStatus = job.jobStatus.questionGeneration;
        jobState.parameters = job.questionGenerationParameters;
        jobState.file = task.segmentation[usePrevious ? usePrevious : task.segmentation.length - 1]?.transcriptFileUrl;
        jobState.segmentMap = task.segmentation[usePrevious ? usePrevious : task.segmentation.length - 1]?.segmentationMap;
      }
      if (job.jobStatus.audioExtraction === TaskStatus.COMPLETED && job.jobStatus.transcriptGeneration === TaskStatus.COMPLETED && job.jobStatus.segmentation === TaskStatus.COMPLETED && job.jobStatus.questionGeneration === TaskStatus.COMPLETED && job.jobStatus.uploadContent !== TaskStatus.PENDING) {
        console.log("All previous tasks completed, setting current task to UPLOAD_CONTENT");
        jobState.currentTask = TaskType.UPLOAD_CONTENT
        jobState.taskStatus = job.jobStatus.uploadContent;
        jobState.parameters = job.uploadParameters;
        jobState.file = task.questionGeneration[usePrevious ? usePrevious : task.questionGeneration.length - 1]?.fileUrl;
        jobState.segmentMap = task.questionGeneration[usePrevious ? usePrevious : task.questionGeneration.length - 1]?.segmentMapUsed;
      }
      console.log(jobState)
      if (jobState.currentTask !== TaskType.AUDIO_EXTRACTION && jobState.currentTask) {
        if (!(jobState.file || jobState.segmentMap)) {
          throw new BadRequestError(`No file URL found for the current task: ${jobState.currentTask}`);
        }
      }
      return jobState;
    });
  }

  secondsToTimeString(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    // Format with leading zeros and 3 decimal places for seconds
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toFixed(3).padStart(6, '0')
    ].join(':');
  }

  async uploadContent(jobId: string, jobState: JobState): Promise<any> {
    return this._withTransaction(async session => {
      const jobData = await this.genAIRepository.getById(jobId, session);
      try {
        if (!jobData) {
          throw new NotFoundError(`Job with ID ${jobId} not found`);
        }
        // Fetch and parse the .json questions file from GCloud link
        let allQuestionsData: any[] = [];
        try {
          const agent = appConfig.isProduction || appConfig.isStaging ? new SocksProxyAgent(aiConfig.proxyAddress) : undefined;

          const axiosOptions = {
            httpAgent: agent,
            httpsAgent: agent,
          };

          const response = await axios.get(jobState.file, axiosOptions);
          // Expecting { segmentsMap: {...}, questionsData: [...] }
          if (response.data) {
            allQuestionsData = response.data;
          } else {
            throw new Error('JSON file must contain segmentsMap and questionsData');
          }
        } catch (error) {
          throw new Error(`Failed to fetch or parse questions file from URL: ${jobState.file}. Error: ${error}`);
        }
        const questionsGroupedBySegment: Record<string, any[]> = {};
        if (Array.isArray(allQuestionsData)) {
          for (const question of allQuestionsData) {
            const segId = (question as any).segmentId;
            console.log(jobState.segmentMap.find((s) => s === Number(segId)));
            if (!questionsGroupedBySegment[segId]) {
              questionsGroupedBySegment[segId] = [];
            }
            questionsGroupedBySegment[segId].push(question);
          }
        }

        // Prepare tracking arrays
        const createdVideoItemsInfo: Array<{
          id?: string;
          name: string;
          segmentId: string;
          startTime: string;
          endTime: string;
          points: number;
        }> = [];
        const createdQuizItemsInfo: Array<{
          id?: string;
          name: string;
          segmentId: string;
          questionCount: number;
        }> = [];
        const createdQuestionBanksInfo: Array<{
          id: string;
          name: string;
          segmentId: string;
          questionCount: number;
          questionIds: string[];
        }> = [];

        let previousSegmentEndTime = 0.0;

        for (const currentSegmentId of jobState.segmentMap) {
          const segmentStartTime = previousSegmentEndTime;
          const currentSegmentEndTime = currentSegmentId;

          // Create Video Item for the segment
          const videoSegName = jobData.uploadParameters.videoItemBaseName ? jobData.uploadParameters.videoItemBaseName : `Video`;

          const videoItemBody: CreateItemBody = {
            name: videoSegName,
            description: `Video content`,
            type: ItemType.VIDEO,
            videoDetails: {
              URL: jobData.url,
              startTime: this.secondsToTimeString(segmentStartTime),
              endTime: this.secondsToTimeString(currentSegmentEndTime),
              points: 10,
            },
          };
          const createdVideoItem = await this.itemService.createItem(
            (jobState.parameters as UploadParameters).versionId,
            (jobState.parameters as UploadParameters).moduleId,
            (jobState.parameters as UploadParameters).sectionId,
            videoItemBody,
          );
                  createdVideoItemsInfo.push({
            id: createdVideoItem.createdItem?._id?.toString(),
            name: videoSegName,
            segmentId: String(currentSegmentId),
            startTime: this.secondsToTimeString(segmentStartTime),
            endTime: this.secondsToTimeString(currentSegmentEndTime),
            points: 10,
          });

          // Create Question Bank and Questions for the segment
          const questionsForSegment = questionsGroupedBySegment[currentSegmentId] || [];
          if (questionsForSegment.length > 0) {
                      // Create Question Bank for this segment
            const questionBankName = `Question Bank - Segment (${segmentStartTime} - ${currentSegmentEndTime})`;
            const questionBank = new QuestionBank({
              title: questionBankName,
              description: `Question bank for video segment from ${segmentStartTime} to ${currentSegmentEndTime}."`,
              courseId: (jobState.parameters as UploadParameters).courseId,
              courseVersionId: (jobState.parameters as UploadParameters).versionId,
              questions: [], // Will be populated after creating questions
              tags: [`segment_${currentSegmentId}`, 'ai_generated'],
            });

            const questionBankId = await this.questionBankService.create(questionBank);

            // Create individual questions and add them to the question bank
            const createdQuestionIds: string[] = [];
            for (const questionData of questionsForSegment) {
              try {
                // Validate and truncate hint if it's too long
                let hint = questionData.question.hint;
                const MAX_HINT_LENGTH = 80; // Maximum hint length in characters
                
                if (hint && typeof hint === 'string' && hint.length > MAX_HINT_LENGTH) {
                  // Truncate hint and add ellipsis
                  hint = hint.substring(0, MAX_HINT_LENGTH - 3) + '...';
                  console.log(`Hint truncated for question in segment ${currentSegmentId}: Original length ${questionData.question.hint.length}, truncated to ${hint.length}`);
                }

                const questionnew = QuestionFactory.createQuestion({question: questionData.question,solution: questionData.solution}, jobData.userId);

                const questionId = await this.questionService.create(questionnew);
                createdQuestionIds.push(questionId);

                // Add question to the question bank
                await this.questionBankService.addQuestion(questionBankId, questionId);
              } catch (questionError) {
                console.warn(`Failed to create question for segment ${currentSegmentId}:`, questionError);
              }
            }

            createdQuestionBanksInfo.push({
              id: questionBankId,
              name: questionBankName,
              segmentId: String(currentSegmentId),
              questionCount: createdQuestionIds.length,
              questionIds: createdQuestionIds,
            });

            const quizSegName = jobData.uploadParameters.quizItemBaseName ? jobData.uploadParameters.quizItemBaseName : `Quiz`;

            const quizItemBody: CreateItemBody = {
                name: quizSegName,
                description: `Quiz for video segment from ${segmentStartTime} to ${currentSegmentEndTime}. This quiz's points are based on its questions.`,
              type: ItemType.QUIZ,
              quizDetails: {
                passThreshold: 0.7,
                maxAttempts: 1000,
                quizType: 'NO_DEADLINE',
                approximateTimeToComplete: '00:05:00',
                allowPartialGrading: true,
                allowHint: true,
                showCorrectAnswersAfterSubmission: true,
                showExplanationAfterSubmission: true,
                showScoreAfterSubmission: true,
                questionVisibility: createdQuestionIds.length,
                releaseTime: new Date(),
                deadline: undefined,
              },
            };
            
            const createdQuizItem = await this.itemService.createItem(
              (jobState.parameters as UploadParameters).versionId,
              (jobState.parameters as UploadParameters).moduleId,
              (jobState.parameters as UploadParameters).sectionId,
              quizItemBody,
            );

            // Link the QuestionBank to the Quiz
            const quizId = createdQuizItem.createdItem?._id?.toString();
            if (quizId && questionBankId) {
              try {
                await this.quizService.addQuestionBank(quizId, {
                  bankId: questionBankId,
                  count: jobData.uploadParameters.questionsPerQuiz ?? 2,
                  tags: ['AI Generated']
                });
              } catch (linkError) {
                console.warn(
                  `Failed to link question bank ${questionBankId} to quiz ${quizId}:`,
                  linkError,
                );
              }
            }

            createdQuizItemsInfo.push({
              id: createdQuizItem.createdItem?._id?.toString(),
              name: quizSegName,
              segmentId: String(currentSegmentId),
              questionCount: createdQuestionIds.length,
            });
          }
          
          previousSegmentEndTime = currentSegmentEndTime;
        }
        jobData.jobStatus.uploadContent = TaskStatus.COMPLETED;
        const taskDAta = await this.genAIRepository.getTaskDataByJobId(jobId, session);
        if (!taskDAta.uploadContent) {
          taskDAta.uploadContent = [{ status: TaskStatus.COMPLETED}];
        }
        taskDAta.uploadContent.push({
          status: TaskStatus.COMPLETED,
        });
        await this.genAIRepository.updateTaskData(jobId, taskDAta, session);
        await this.genAIRepository.update(jobId, jobData, session);
        return {
          message:
            'Video items, Quiz items, and Question banks for segments generated successfully from video.',
          videoURL: jobData.url,
          generatedItemsSummary: {
            totalSegmentsProcessed: jobState.segmentMap.length,
            totalVideoItemsCreated: createdVideoItemsInfo.length,
            totalQuizItemsCreated: createdQuizItemsInfo.length,
            totalQuestionBanksCreated: createdQuestionBanksInfo.length,
            totalQuestionsGenerated: createdQuestionBanksInfo.reduce((sum, bank) => sum + bank.questionCount, 0),
          },
          createdVideoItems: createdVideoItemsInfo,
          createdQuizItems: createdQuizItemsInfo,
          createdQuestionBanks: createdQuestionBanksInfo,
        };
      } catch (error) {
        jobData.jobStatus.uploadContent = TaskStatus.FAILED;
        await this.genAIRepository.update(jobId, jobData, session);
        const taskDAta = await this.genAIRepository.getTaskDataByJobId(jobId, session);
        if (!taskDAta) {
          throw new NotFoundError(`Task data for job ID ${jobId} not found`);
        }
        if (!taskDAta.uploadContent) {
          taskDAta.uploadContent = [{ status: TaskStatus.FAILED, error: error.message }];
        }
        taskDAta.uploadContent.push({
          status: TaskStatus.FAILED,
          error: error.message,
        });
        await this.genAIRepository.updateTaskData(jobId, taskDAta, session);
        console.error(`Error during content upload for job ${jobId}:`, error);
        throw new InternalServerError(`Failed to upload content for job ${jobId}: ${error.message}`);
      }
    });
  }
}