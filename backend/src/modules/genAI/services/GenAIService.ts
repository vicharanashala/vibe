import { injectable, inject } from 'inversify';
import { WebhookService } from './WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { JobBody } from '../classes/validators/GenAIValidators.js';
import { GenAIRepository } from '../repositories/providers/mongodb/GenAIRepository.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ItemType, MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {
  audioData,
  conceptMapData,
  ConceptMapEdgeData,
  ConceptMapNodeData,
  ConceptMapParameters,
  contentUploadData,
  GenAIBody,
  JobState,
  JobStatus,
  questionGenerationData,
  QuestionGenerationParameters,
  segmentationData,
  SegmentationParameters,
  TaskData,
  TaskStatus,
  TaskType,
  TranscriptParameters,
  trascriptGenerationData,
  UploadParameters,
} from '../classes/transformers/GenAI.js';
import { ConceptMapService } from './ConceptMapService.js';
import { ConceptMapRepository } from '../repositories/providers/mongodb/ConceptMapRepository.js';
import { ConceptMap } from '../classes/transformers/ConceptMap.js';
import { QuestionFactory } from '#root/modules/quizzes/classes/index.js';
import { CreateItemBody } from '#root/modules/courses/classes/index.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';
import { ItemService } from '#root/modules/courses/services/ItemService.js';
import { QuestionBank } from '#root/modules/quizzes/classes/transformers/QuestionBank.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import {
  QuestionBankService,
  QuizService,
} from '#root/modules/quizzes/services/index.js';
import { QuestionService } from '#root/modules/quizzes/services/QuestionService.js';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig } from '#root/config/ai.js';
import { appConfig } from '#root/config/app.js';
import { ANOMALIES_TYPES } from '#root/modules/anomalies/types.js';
import { CloudStorageService } from '#root/modules/anomalies/index.js';
import { storageConfig } from '#root/config/storage.js';
import { ObjectId } from 'mongodb';

type BloomLevelKey =
  | 'knowledge'
  | 'understanding'
  | 'application'
  | 'analysis'
  | 'evaluation'
  | 'creation'
  | 'unclassified';

@injectable()
export class GenAIService extends BaseService {
  constructor(
    @inject(GENAI_TYPES.WebhookService)
    private readonly webhookService: WebhookService,

    @inject(GENAI_TYPES.ConceptMapService)
    private readonly conceptMapService: ConceptMapService,

    @inject(GENAI_TYPES.ConceptMapRepo)
    private readonly conceptMapRepository: ConceptMapRepository,

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
    }),
  ) {
    super(mongoDatabase);
  }

  /**
   * Start a new genAI job
   * @param jobData Job configuration data
   * @returns Created job data
   */
  async startJob(
    userId: string,
    jobData: JobBody,
    audio?: Express.Multer.File,
  ): Promise<{ jobId: string }> {
    return this._withTransaction(async session => {
      // Prepare job data and send to AI server]
      const result = await this.webhookService.AIServerCheck();
      if (result !== 200) {
        throw new Error('Failed to connect to AI server');
      }
      const jobId = await this.genAIRepository.save(
        userId,
        jobData,
        audio ? true : false,
        jobData.transcript ? true : false,
        session,
      );
      if (audio) {
        // check file type (audio/)
        if (!audio.mimetype.startsWith('audio/')) {
          throw new BadRequestError(
            'Invalid file type. Please upload an audio file.',
          );
        }
        // store on buckets
        const fileName = await this.cloudStorageService.uploadAudio(
          audio,
          jobId,
        );
        await this.genAIRepository.createTaskDataWithAudio(
          jobId,
          fileName,
          `https://storage.googleapis.com/${storageConfig.googleCloud.aiServerBucketName}/${fileName}`,
          session,
        );
      } else if (jobData.transcript) {
        const fileName = await this.cloudStorageService.uploadTranscript(
          jobData.transcript,
          jobId,
        );
        await this.genAIRepository.createTaskDataWithTranscript(
          jobId,
          fileName,
          `https://storage.googleapis.com/${storageConfig.googleCloud.aiServerBucketName}/${fileName}`,
          session,
        );
      } else {
        await this.genAIRepository.createTaskData(jobId, session);
      }

      return { jobId };
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
        throw new InternalServerError('Task upload content cannot be aborted');
      }

      await this.webhookService.abortTask(jobId);
      await this.updateJob(jobId, runningTask, {
        status: TaskStatus.ABORTED,
        error: 'Task aborted by user',
      });
    });
  }

  removeUndefined(obj: any) {
    if (!obj) return null;
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined),
    );
  }

  async approveTaskToStart(
    jobId: string,
    userId: string,
    usePrevious?: number,
    parameters?: Partial<
      | TranscriptParameters
      | SegmentationParameters
      | ConceptMapParameters
      | QuestionGenerationParameters
      | UploadParameters
    >,
  ): Promise<any> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      // if (job.userId !== userId) {
      //   throw new NotFoundError(`User with ID ${userId} does not have permission to approve this job`);
      // }
      const jobState = await this.getJobState(jobId, usePrevious);
      jobState.parameters = {
        ...jobState.parameters,
        ...this.removeUndefined(parameters),
      };
      if (jobState.taskStatus == TaskStatus.COMPLETED) {
        throw new BadRequestError(
          `The task ${jobState.currentTask} for job ID ${jobId} is already completed, you can either rerun the task or approve to move to the next taask.`,
        );
      }
      if (jobState.currentTask === TaskType.UPLOAD_CONTENT) {
        // Persist upload parameters to DB before content upload
        let resolvedUploadParameters = {
          ...job.uploadParameters,
        } as UploadParameters;

        if (parameters) {
          resolvedUploadParameters = {
            ...job.uploadParameters,
            ...this.removeUndefined(parameters as Partial<UploadParameters>),
          };

          // Keep upload destination stable for the life of this job.
          // UI-provided module/section at upload time should not redirect content elsewhere.
          if (job.uploadParameters.moduleId) {
            resolvedUploadParameters.moduleId = job.uploadParameters.moduleId;
          }
          if (job.uploadParameters.sectionId) {
            resolvedUploadParameters.sectionId = job.uploadParameters.sectionId;
          }

          await this.genAIRepository.update(jobId, {
            uploadParameters: resolvedUploadParameters,
          }, session);
        }

        jobState.parameters = resolvedUploadParameters;
        const result = await this.uploadContent(jobId, jobState);
        return result;
      }
      if (jobState.currentTask === TaskType.CONCEPT_MAP) {
        // Backend-executed (like UPLOAD_CONTENT): never sent to the AI
        // server / webhook path.
        return this.runConceptMapTask(jobId, jobState, session);
      }
      return this.webhookService.approveTaskStart(jobId, jobState);
    });
  }

  private async runConceptMapTask(
    jobId: string,
    jobState: JobState,
    session: any,
  ): Promise<any> {
    const job = await this.genAIRepository.getById(jobId, session);
    const taskData = await this.genAIRepository.getTaskDataByJobId(
      jobId,
      session,
    );
    if (!job || !taskData) {
      throw new NotFoundError(`Job with ID ${jobId} not found`);
    }
    if (!jobState.file) {
      throw new BadRequestError(
        'No transcript file available for concept map generation',
      );
    }
    let result: conceptMapData;
    try {
      const chunks = await this.conceptMapService.fetchTranscriptChunks(
        jobState.file,
      );
      result = await this.conceptMapService.generate(
        chunks,
        jobState.segmentMap ?? [],
        jobState.parameters as ConceptMapParameters | undefined,
      );
    } catch (error: any) {
      result = {
        status: TaskStatus.FAILED,
        error: error?.message || 'Concept map generation failed',
      };
    }
    job.jobStatus.conceptMap = result.status;
    if (taskData.conceptMap) {
      taskData.conceptMap.push(result);
    } else {
      taskData.conceptMap = [result];
    }
    const updatedJob = await this.genAIRepository.update(jobId, job, session);
    const updatedTaskData = await this.genAIRepository.updateTaskData(
      jobId,
      taskData,
      session,
    );
    if (!updatedJob || !updatedTaskData) {
      throw new InternalServerError(
        `Failed to store concept map result for job ID ${jobId}`,
      );
    }
    return { message: 'Success', data: result };
  }

  /**
   * Retroactive concept-map generation for an already-published job (e.g.
   * lectures uploaded before the feature existed). The job gains
   * `jobStatus.conceptMap`, a map is generated from the stored segmentation,
   * and it is published immediately — anchors are re-derived from the
   * section's ACTUAL items (the created-items info was never persisted):
   * video items are matched by the job's URL plus the exact clip-boundary
   * strings the upload wrote, and each segment's quiz is the QUIZ item that
   * directly follows its video in the section order.
   */
  async generateRetroactiveConceptMap(jobId: string): Promise<conceptMapData> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      const taskData = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
      if (!job || !taskData) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      if (job.jobStatus.uploadContent !== TaskStatus.COMPLETED) {
        throw new BadRequestError(
          'Retroactive concept-map generation is only available for jobs whose content has been published',
        );
      }
      const seg = taskData.segmentation?.[taskData.segmentation.length - 1];
      if (!seg?.transcriptFileUrl || !seg.segmentationMap?.length) {
        throw new BadRequestError(
          'Job has no stored segmentation data to generate a concept map from',
        );
      }

      let result: conceptMapData;
      try {
        const chunks = await this.conceptMapService.fetchTranscriptChunks(
          seg.transcriptFileUrl,
        );
        result = await this.conceptMapService.generate(
          chunks,
          seg.segmentationMap,
          job.conceptMapParameters,
        );
      } catch (error: any) {
        result = {
          status: TaskStatus.FAILED,
          error: error?.message || 'Concept map generation failed',
        };
      }
      // The legacy job gains the field here, by explicit teacher request.
      job.jobStatus.conceptMap = result.status;
      if (taskData.conceptMap) {
        taskData.conceptMap.push(result);
      } else {
        taskData.conceptMap = [result];
      }

      if (result.status === TaskStatus.COMPLETED) {
        const uploadParams = job.uploadParameters;
        const items = await this.itemService.readSectionItemsInternal(
          uploadParams.versionId,
          uploadParams.moduleId,
          uploadParams.sectionId,
        );
        const videos = items.filter(
          i => i.type === ItemType.VIDEO && i.details?.URL === job.url,
        );
        const quizAfterVideo = (videoId: string): string | undefined => {
          const index = items.findIndex(i => i._id === videoId);
          if (index < 0) return undefined;
          for (let j = index + 1; j < items.length; j++) {
            if (items[j].type === ItemType.QUIZ) return items[j]._id;
            if (items[j].type === ItemType.VIDEO) return undefined;
          }
          return undefined;
        };
        let previousEnd = 0;
        const createdVideoItemsInfo: Array<{ id?: string; segmentId: string }> = [];
        const createdQuizItemsInfo: Array<{ id?: string; segmentId: string }> = [];
        seg.segmentationMap.forEach((segmentEnd, index) => {
          const startString = this.secondsToTimeString(previousEnd);
          const endString = this.secondsToTimeString(Number(segmentEnd));
          const video =
            videos.find(
              v =>
                v.details?.startTime === startString &&
                v.details?.endTime === endString,
            ) ?? videos[index];
          createdVideoItemsInfo.push({
            id: video?._id,
            segmentId: String(segmentEnd),
          });
          createdQuizItemsInfo.push({
            id: video ? quizAfterVideo(video._id) : undefined,
            segmentId: String(segmentEnd),
          });
          previousEnd = Number(segmentEnd);
        });

        const jobState = new JobState();
        jobState.segmentMap = seg.segmentationMap;
        jobState.parameters = uploadParams;
        try {
          await this.publishConceptMap(
            jobId,
            job,
            jobState,
            taskData,
            createdVideoItemsInfo,
            createdQuizItemsInfo,
            session,
          );
        } catch (error) {
          console.error(
            `Failed to publish retroactive concept map for job ${jobId}:`,
            error,
          );
        }
      }

      const updatedJob = await this.genAIRepository.update(jobId, job, session);
      const updatedTaskData = await this.genAIRepository.updateTaskData(
        jobId,
        taskData,
        session,
      );
      if (!updatedJob || !updatedTaskData) {
        throw new InternalServerError(
          `Failed to store retroactive concept map for job ID ${jobId}`,
        );
      }
      return result;
    });
  }

  async rerunTask(
    jobId: string,
    userId: string,
    usePrevious?: number,
    parameters?: Partial<
      | TranscriptParameters
      | SegmentationParameters
      | ConceptMapParameters
      | QuestionGenerationParameters
      | UploadParameters
    >,
  ): Promise<any> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      // if (job.userId !== userId) {
      //   throw new NotFoundError(`User with ID ${userId} does not have permission to approve this job`);
      // }
      const jobState = await this.getJobState(jobId, usePrevious);
      if (
        jobState.taskStatus !== TaskStatus.COMPLETED &&
        jobState.taskStatus !== TaskStatus.FAILED &&
        jobState.taskStatus !== TaskStatus.ABORTED
      ) {
        throw new BadRequestError(
          `The task ${jobState.currentTask} for job ID ${jobId} has not been completed yet, please approve the task to start.`,
        );
      }
      jobState.parameters = {
        ...jobState.parameters,
        ...this.removeUndefined(parameters),
      };
      if (jobState.currentTask === TaskType.UPLOAD_CONTENT) {
        // Persist upload parameters to DB before content upload
        let resolvedUploadParameters = {
          ...job.uploadParameters,
        } as UploadParameters;

        if (parameters) {
          resolvedUploadParameters = {
            ...job.uploadParameters,
            ...this.removeUndefined(parameters as Partial<UploadParameters>),
          };

          // Keep upload destination stable for the life of this job.
          if (job.uploadParameters.moduleId) {
            resolvedUploadParameters.moduleId = job.uploadParameters.moduleId;
          }
          if (job.uploadParameters.sectionId) {
            resolvedUploadParameters.sectionId = job.uploadParameters.sectionId;
          }

          await this.genAIRepository.update(jobId, {
            uploadParameters: resolvedUploadParameters,
          }, session);
        }

        jobState.parameters = resolvedUploadParameters;
        const result = await this.uploadContent(jobId, jobState);
        return result;
      }
      if (jobState.currentTask === TaskType.CONCEPT_MAP) {
        return this.runConceptMapTask(jobId, jobState, session);
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
      } else if (job.jobStatus.questionGeneration === TaskStatus.COMPLETED) {
        job.jobStatus.uploadContent = TaskStatus.WAITING;
      } else if (job.jobStatus.conceptMap === TaskStatus.COMPLETED) {
        job.jobStatus.questionGeneration = TaskStatus.WAITING;
      } else if (job.jobStatus.segmentation === TaskStatus.COMPLETED) {
        // Legacy jobs have no conceptMap field: skip straight to questions.
        if (job.jobStatus.conceptMap !== undefined) {
          job.jobStatus.conceptMap = TaskStatus.WAITING;
        } else {
          job.jobStatus.questionGeneration = TaskStatus.WAITING;
        }
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
    });
  }

  /**
   * Get job status by ID
   * @param jobId The jobjobState ID to retrieve status for
   * @returns Job status data
   */
  async getJobStatus(jobId: string): Promise<GenAIBody> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError('job with the given Id not found');
      }
      job._id = job._id.toString();
      return job;
    });
  }

  /**
   * Get task status by job ID and task type
   * @param jobId The job ID to retrieve task status for
   * @param type The type of task to retrieve status for
   * @returns Task status data
   */
  // async getTaskStatus(
  //   jobId: string,
  //   type: TaskType,
  // ): Promise<
  //   | audioData[]
  //   | trascriptGenerationData[]
  //   | segmentationData[]
  //   | questionGenerationData[]
  //   | contentUploadData[]
  // > {
  //   return this._withTransaction(async session => {
  //     const taskData = await this.genAIRepository.getTaskDataByJobId(
  //       jobId,
  //       session,
  //     );
  //     if (!taskData) {
  //       throw new NotFoundError(`Task data for job ID ${jobId} not found`);
  //     }
  //     switch (type) {
  //       case TaskType.AUDIO_EXTRACTION:
  //         return taskData.audioExtraction;
  //       case TaskType.TRANSCRIPT_GENERATION:
  //         return taskData.transcriptGeneration;
  //       case TaskType.SEGMENTATION:
  //         return taskData.segmentation;
  //       case TaskType.QUESTION_GENERATION:
  //         return taskData.questionGeneration;
  //       case TaskType.UPLOAD_CONTENT:
  //         return taskData.uploadContent;
  //       default:
  //         throw new BadRequestError(`Invalid task type: ${type}`);
  //     }
  //   });
  // }

  async getTaskStatus(
    jobId: string,
    type: TaskType,
  ): Promise<any> {
    return this._withTransaction(async session => {

      const taskData = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );

      if (!taskData) {
        return {
          task: type,
          status: "WAITING",
          message: "Job not initialized yet"
        };
      }

      let result;

      switch (type) {
        case TaskType.AUDIO_EXTRACTION:
          result = taskData.audioExtraction;
          break;
        case TaskType.TRANSCRIPT_GENERATION:
          result = taskData.transcriptGeneration;
          break;
        case TaskType.SEGMENTATION:
          result = taskData.segmentation;
          break;
        case TaskType.CONCEPT_MAP:
          result = taskData.conceptMap;
          break;
        case TaskType.QUESTION_GENERATION:
          result = taskData.questionGeneration;
          break;
        case TaskType.UPLOAD_CONTENT:
          result = taskData.uploadContent;
          break;
        default:
          throw new BadRequestError(`Invalid task type: ${type}`);
      }

      if (!result) {
        return {
          task: type,
          status: "WAITING"
        };
      }

      return result;
    });
  }

  /**
   * Teacher approval edit: remove one concept from the job's latest generated
   * concept map (the entry the preview shows and UPLOAD_CONTENT publishes).
   * Incident edges drop and parent→child chains are re-bridged in
   * ConceptMapService.removeNode. Returns the edited map data.
   */
  async editConceptMapPreview(
    jobId: string,
    removeNodeId: string,
  ): Promise<conceptMapData> {
    return this._withTransaction(async session => {
      const taskData = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
      if (!taskData) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      const entries = taskData.conceptMap ?? [];
      // The preview and publish both use the LATEST completed entry with
      // nodes — edit exactly that one.
      let latest: conceptMapData | undefined;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.status === TaskStatus.COMPLETED && entry.nodes?.length) {
          latest = entry;
          break;
        }
      }
      if (!latest) {
        throw new NotFoundError(
          `No generated concept map found for job ${jobId}`,
        );
      }
      let result: { nodes: ConceptMapNodeData[]; edges: ConceptMapEdgeData[] };
      try {
        result = this.conceptMapService.removeNode(
          latest.nodes!,
          latest.edges ?? [],
          removeNodeId,
        );
      } catch (error: any) {
        throw new BadRequestError(error?.message || 'Invalid node removal');
      }
      latest.nodes = result.nodes;
      latest.edges = result.edges;
      const updatedTask = await this.genAIRepository.updateTaskData(
        jobId,
        taskData,
        session,
      );
      if (!updatedTask) {
        throw new InternalServerError(
          `Failed to update task data for job ID ${jobId}`,
        );
      }
      return latest;
    });
  }

  async editSegmentMap(
    jobId: string,
    segmentMap: Array<number>,
    index?: number,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const task = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }

      // Initialize segmentation array if it doesn't exist 
      if (!task.segmentation || task.segmentation.length === 0) {
        const lastTranscript = task.transcriptGeneration?.[task.transcriptGeneration.length - 1];
        task.segmentation = [
          {
            status: TaskStatus.COMPLETED,
            segmentationMap: segmentMap,
            transcriptFileUrl: lastTranscript?.fileUrl,
          },
        ];
      } else {
        const resolvedIndex =
          index !== undefined ? index : task.segmentation.length - 1;

        if (resolvedIndex < 0 || resolvedIndex >= task.segmentation.length) {
          throw new BadRequestError(
            `Invalid index: ${resolvedIndex}. Segmentation has ${task.segmentation.length} items.`,
          );
        }

        task.segmentation[resolvedIndex].segmentationMap = segmentMap;
      }

      const updatedTask = await this.genAIRepository.updateTaskData(
        jobId,
        task,
        session,
      );
      if (!updatedTask) {
        throw new InternalServerError(
          `Failed to update task for job ID ${jobId}`,
        );
      }
      const job = await this.genAIRepository.getById(jobId, session);
      if (job) {
        job.jobStatus.segmentation = TaskStatus.COMPLETED;
        // Optionally set the next task to WAITING if it was PENDING
        if (job.jobStatus.questionGeneration === TaskStatus.PENDING) {
          job.jobStatus.questionGeneration = TaskStatus.WAITING;
        }
        await this.genAIRepository.update(jobId, job, session);
      }
    });
  }

  async editQuestionData(
    jobId: string,
    questionData: JSON,
    index?: number,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const task = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }

      // ✅ Default to last index if not specified
      const resolvedIndex =
        index !== undefined ? index : task.questionGeneration.length - 1;

      if (
        resolvedIndex < 0 ||
        resolvedIndex >= task.questionGeneration.length
      ) {
        throw new BadRequestError(
          `Invalid index: ${resolvedIndex}. questionGeneration has ${task.questionGeneration.length} items.`,
        );
      }

      const fileName = task.questionGeneration[resolvedIndex].fileName;
      let newFileName: string;

      if (/_updated(?:_\d+)?\.json$/.test(fileName)) {
        newFileName = fileName.replace(
          /_updated(?:_(\d+))?\.json$/,
          (match, p1) => {
            const nextNum = p1 ? parseInt(p1, 10) + 1 : 1;
            return `_updated_${nextNum}.json`;
          },
        );
      } else {
        newFileName = fileName.replace(/\.json$/, '_updated.json');
      }

      const data = JSON.stringify(questionData);

      await this.storage
        .bucket(appConfig.firebase.storageBucket)
        .file(newFileName)
        .save(Buffer.from(data), { contentType: 'application/json' });

      task.questionGeneration[resolvedIndex].fileName = newFileName;
      task.questionGeneration[
        resolvedIndex
      ].fileUrl = `https://storage.googleapis.com/${appConfig.firebase.storageBucket}/${newFileName}`;

      await this.genAIRepository.updateTaskData(jobId, task, session);
    });
  }

  async editTranscript(
    jobId: string,
    transcript: JSON,
    index: number,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const task = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      const fileName = task.transcriptGeneration[index].fileName;
      let newFileName: string;
      if (/_updated(?:_\d+)?\.json$/.test(fileName)) {
        newFileName = fileName.replace(
          /_updated(?:_(\d+))?\.json$/,
          (match, p1) => {
            const nextNum = p1 ? parseInt(p1, 10) + 1 : 1;
            return `_updated_${nextNum}.json`;
          },
        );
      } else {
        newFileName = fileName.replace(/\.json$/, '_updated.json');
      }
      const data = JSON.stringify(transcript);
      await this.storage
        .bucket(appConfig.firebase.storageBucket)
        .file(newFileName)
        .save(Buffer.from(data), { contentType: 'application/json' });
      task.transcriptGeneration[index].fileName = newFileName;
      task.transcriptGeneration[
        index
      ].fileUrl = `https://storage.googleapis.com/${appConfig.firebase.storageBucket}/${newFileName}`;
      await this.genAIRepository.updateTaskData(jobId, task, session);
    });
  }

  async getAllTasksStatus(jobId: string): Promise<any> {
    return this._withTransaction(async session => {
      const taskData = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
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
  async updateJob(
    jobId: string,
    task: string,
    jobData?:
      | audioData
      | trascriptGenerationData
      | segmentationData
      | questionGenerationData
      | contentUploadData,
  ): Promise<any> {
    return this._withTransaction(async session => {
      // Retrieve existing job
      const job = await this.genAIRepository.getById(jobId, session);
      const taskData = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
      if (!job || !taskData) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      if (
        jobData.status === TaskStatus.COMPLETED ||
        jobData.status === TaskStatus.FAILED ||
        jobData.status === TaskStatus.ABORTED
      ) {
        switch (task) {
          case TaskType.AUDIO_EXTRACTION:
            job.jobStatus.audioExtraction = jobData.status;
            if (taskData.audioExtraction) {
              taskData.audioExtraction.push({ ...(jobData as audioData) });
            } else {
              taskData.audioExtraction = [{ ...(jobData as audioData) }];
            }
            break;
          case TaskType.TRANSCRIPT_GENERATION:
            job.jobStatus.transcriptGeneration = jobData.status;
            if (taskData.transcriptGeneration) {
              taskData.transcriptGeneration.push({
                ...(jobData as trascriptGenerationData),
              });
            } else {
              taskData.transcriptGeneration = [
                { ...(jobData as trascriptGenerationData) },
              ];
            }
            break;
          case TaskType.SEGMENTATION:
            job.jobStatus.segmentation = jobData.status;
            if (taskData.segmentation) {
              taskData.segmentation.push({ ...(jobData as segmentationData) });
            } else {
              taskData.segmentation = [{ ...(jobData as segmentationData) }];
            }
            break;
          case TaskType.CONCEPT_MAP:
            job.jobStatus.conceptMap = jobData.status;
            if (taskData.conceptMap) {
              taskData.conceptMap.push({ ...(jobData as conceptMapData) });
            } else {
              taskData.conceptMap = [{ ...(jobData as conceptMapData) }];
            }
            break;
          case TaskType.QUESTION_GENERATION:
            job.jobStatus.questionGeneration = jobData.status;
            if (taskData.questionGeneration) {
              taskData.questionGeneration.push({
                ...(jobData as questionGenerationData),
              });
            } else {
              taskData.questionGeneration = [
                { ...(jobData as questionGenerationData) },
              ];
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
          case TaskType.CONCEPT_MAP:
            job.jobStatus.conceptMap = jobData.status;
            break;
          case TaskType.QUESTION_GENERATION:
            job.jobStatus.questionGeneration = jobData.status;
            break;
        }
      }
      // Update job and task data
      const updatedJob = await this.genAIRepository.update(jobId, job, session);
      const updatedTaskData = await this.genAIRepository.updateTaskData(
        jobId,
        taskData,
        session,
      );
      if (!updatedJob || !updatedTaskData) {
        throw new NotFoundError(
          `Failed to update job or task data for job ID ${jobId}`,
        );
      }
    });
  }

  async getJobState(jobId: string, usePrevious?: number): Promise<JobState> {
    return this._withTransaction(async session => {
      const job = await this.genAIRepository.getById(jobId, session);
      if (!job) {
        throw new NotFoundError(`Job with ID ${jobId} not found`);
      }
      const task = await this.genAIRepository.getTaskDataByJobId(
        jobId,
        session,
      );
      if (!task) {
        throw new NotFoundError(`Task data for job ID ${jobId} not found`);
      }
      const jobState = new JobState();
      if (
        !(
          job.jobStatus.audioExtraction === TaskStatus.PENDING ||
          job.jobStatus.audioExtraction === TaskStatus.RUNNING
        )
      ) {
        jobState.currentTask = TaskType.AUDIO_EXTRACTION;
        if (job.jobStatus.audioExtraction === TaskStatus.WAITING)
          jobState.currentTask = null;
        jobState.taskStatus = job.jobStatus.audioExtraction;
        jobState.url = job.url;
      }
      if (
        !(
          job.jobStatus.transcriptGeneration === TaskStatus.PENDING ||
          job.jobStatus.transcriptGeneration === TaskStatus.RUNNING
        )
      ) {
        jobState.currentTask = TaskType.TRANSCRIPT_GENERATION;
        if (job.jobStatus.transcriptGeneration === TaskStatus.WAITING)
          jobState.currentTask = TaskType.AUDIO_EXTRACTION;
        jobState.taskStatus = job.jobStatus.transcriptGeneration;
        jobState.parameters = job.transcriptParameters;
        if (task.audioExtraction)
          jobState.file =
            task.audioExtraction[
              usePrevious ? usePrevious : task.audioExtraction.length - 1
            ]?.fileUrl;
      }
      if (
        !(
          job.jobStatus.segmentation === TaskStatus.PENDING ||
          job.jobStatus.segmentation === TaskStatus.RUNNING
        )
      ) {
        jobState.currentTask = TaskType.SEGMENTATION;
        if (job.jobStatus.segmentation === TaskStatus.WAITING)
          jobState.currentTask = TaskType.TRANSCRIPT_GENERATION;
        jobState.taskStatus = job.jobStatus.segmentation;
        jobState.parameters = job.segmentationParameters;
        jobState.file =
          task.transcriptGeneration[
            usePrevious ? usePrevious : task.transcriptGeneration.length - 1
          ]?.fileUrl;
      }
      if (
        job.jobStatus.conceptMap !== undefined &&
        !(
          job.jobStatus.conceptMap === TaskStatus.PENDING ||
          job.jobStatus.conceptMap === TaskStatus.RUNNING
        )
      ) {
        jobState.currentTask = TaskType.CONCEPT_MAP;
        jobState.taskStatus = job.jobStatus.conceptMap;
        jobState.parameters = job.conceptMapParameters;
        jobState.file =
          task.segmentation[
            usePrevious ? usePrevious : task.segmentation.length - 1
          ]?.transcriptFileUrl;
        jobState.segmentMap =
          task.segmentation[
            usePrevious ? usePrevious : task.segmentation.length - 1
          ]?.segmentationMap;
      }
      if (
        !(
          job.jobStatus.questionGeneration === TaskStatus.PENDING ||
          job.jobStatus.questionGeneration === TaskStatus.RUNNING
        )
      ) {
        jobState.currentTask = TaskType.QUESTION_GENERATION;
        if (job.jobStatus.questionGeneration === TaskStatus.WAITING)
          jobState.currentTask = TaskType.SEGMENTATION;
        jobState.taskStatus = job.jobStatus.questionGeneration;
        jobState.parameters = job.questionGenerationParameters;
        jobState.file =
          task.segmentation[
            usePrevious ? usePrevious : task.segmentation.length - 1
          ]?.transcriptFileUrl;
        jobState.segmentMap =
          task.segmentation[
            usePrevious ? usePrevious : task.segmentation.length - 1
          ]?.segmentationMap;
      }
      if (
        job.jobStatus.audioExtraction === TaskStatus.COMPLETED &&
        job.jobStatus.transcriptGeneration === TaskStatus.COMPLETED &&
        job.jobStatus.segmentation === TaskStatus.COMPLETED &&
        (job.jobStatus.conceptMap === undefined ||
          job.jobStatus.conceptMap === TaskStatus.COMPLETED) &&
        job.jobStatus.questionGeneration === TaskStatus.COMPLETED &&
        job.jobStatus.uploadContent !== TaskStatus.PENDING
      ) {
        jobState.currentTask = TaskType.UPLOAD_CONTENT;
        jobState.taskStatus = job.jobStatus.uploadContent;
        jobState.parameters = job.uploadParameters;
        jobState.file =
          task.questionGeneration[
            usePrevious ? usePrevious : task.questionGeneration.length - 1
          ]?.fileUrl;
        jobState.segmentMap =
          task.questionGeneration[
            usePrevious ? usePrevious : task.questionGeneration.length - 1
          ]?.segmentMapUsed;
      }
      if (
        jobState.currentTask !== TaskType.AUDIO_EXTRACTION &&
        jobState.currentTask
      ) {
        if (!(jobState.file || jobState.segmentMap)) {
          throw new BadRequestError(
            `No file URL found for the current task: ${jobState.currentTask}`,
          );
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
      secs.toFixed(3).padStart(6, '0'),
    ].join(':');
  }

  async uploadContent(jobId: string, jobState: JobState): Promise<any> {
    return this._withTransaction(async session => {
      const jobData = await this.genAIRepository.getById(jobId, session);
      const normalizeBloomLevel = (input: unknown): BloomLevelKey => {
        if (typeof input === 'number') {
          if (input === 1) return 'knowledge';
          if (input === 2) return 'understanding';
          if (input === 3) return 'application';
          if (input === 4) return 'analysis';
          if (input === 5) return 'evaluation';
          if (input === 6) return 'creation';
          return 'unclassified';
        }

        const normalized = String(input || '')
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, '');

        if (
          normalized === 'knowledge' ||
          normalized === 'remember' ||
          normalized === 'remembering' ||
          normalized === 'recall' ||
          normalized === '1' ||
          normalized === 'l1' ||
          normalized === 'level1'
        ) {
          return 'knowledge';
        }

        if (
          normalized === 'understanding' ||
          normalized === 'understand' ||
          normalized === 'comprehension' ||
          normalized === '2' ||
          normalized === 'l2' ||
          normalized === 'level2'
        ) {
          return 'understanding';
        }

        if (
          normalized === 'application' ||
          normalized === 'apply' ||
          normalized === '3' ||
          normalized === 'l3' ||
          normalized === 'level3'
        ) {
          return 'application';
        }

        if (
          normalized === 'analysis' ||
          normalized === 'analyze' ||
          normalized === 'analytical' ||
          normalized === '4' ||
          normalized === 'l4' ||
          normalized === 'level4'
        ) {
          return 'analysis';
        }

        if (
          normalized === 'evaluation' ||
          normalized === 'evaluate' ||
          normalized === '5' ||
          normalized === 'l5' ||
          normalized === 'level5'
        ) {
          return 'evaluation';
        }

        if (
          normalized === 'creation' ||
          normalized === 'create' ||
          normalized === 'synthesis' ||
          normalized === '6' ||
          normalized === 'l6' ||
          normalized === 'level6'
        ) {
          return 'creation';
        }

        return 'unclassified';
      };
      const extractBloomLevel = (question: any): BloomLevelKey => {
        const candidates: unknown[] = [
          question?.bloomLevel,
          question?.question?.bloomLevel,
          question?.level,
          question?.question?.level,
          question?.bloom,
          question?.question?.bloom,
          question?.taxonomy?.bloomLevel,
          question?.metadata?.bloomLevel,
          question?.question?.metadata?.bloomLevel,
        ];

        for (const candidate of candidates) {
          if (candidate && typeof candidate === 'object') {
            const objectLevel = normalizeBloomLevel(
              (candidate as any).level ?? (candidate as any).name,
            );
            if (objectLevel !== 'unclassified') {
              return objectLevel;
            }
          }

          const level = normalizeBloomLevel(candidate);
          if (level !== 'unclassified') {
            return level;
          }
        }

        return 'unclassified';
      };

      const allocateBloomCountsForAttempt = (
        bankQuestionCounts: Array<{ bloomLevel: BloomLevelKey; availableCount: number }>,
        distribution?: {
          knowledge: number;
          understanding: number;
          application: number;
          analysis?: number;
          evaluation?: number;
          creation?: number;
        },
      ): Record<BloomLevelKey, number> => {
        const allocations: Record<BloomLevelKey, number> = {
          knowledge: 0,
          understanding: 0,
          application: 0,
          analysis: 0,
          evaluation: 0,
          creation: 0,
          unclassified: 0,
        };

        const eligibleBanks = bankQuestionCounts.filter(bank => bank.availableCount > 0);
        if (!eligibleBanks.length) {
          return allocations;
        }

        const percentageByBloom: Record<BloomLevelKey, number> = {
          knowledge: distribution?.knowledge ?? 0,
          understanding: distribution?.understanding ?? 0,
          application: distribution?.application ?? 0,
          analysis: distribution?.analysis ?? 0,
          evaluation: distribution?.evaluation ?? 0,
          creation: distribution?.creation ?? 0,
          unclassified: 0,
        };

        const totalVisibleQuestions = eligibleBanks.reduce(
          (sum, bank) => sum + bank.availableCount,
          0,
        );
        const activeTotalPercentage = eligibleBanks.reduce(
          (sum, bank) => sum + (percentageByBloom[bank.bloomLevel] || 0),
          0,
        );

        const weighted = eligibleBanks.map(bank => {
          const percentage = activeTotalPercentage > 0
            ? (percentageByBloom[bank.bloomLevel] || 0) / activeTotalPercentage
            : 1 / eligibleBanks.length;
          const expected = totalVisibleQuestions * percentage;
          const base = Math.min(bank.availableCount, Math.floor(expected));
          return {
            bloomLevel: bank.bloomLevel,
            availableCount: bank.availableCount,
            allocated: base,
            remainder: expected - Math.floor(expected),
          };
        });

        let remaining = totalVisibleQuestions - weighted.reduce((sum, bank) => sum + bank.allocated, 0);

        weighted
          .slice()
          .sort((left, right) => right.remainder - left.remainder)
          .forEach(bank => {
            if (remaining <= 0) return;
            if (bank.allocated >= bank.availableCount) return;
            bank.allocated += 1;
            remaining -= 1;
          });

        if (remaining > 0) {
          weighted.forEach(bank => {
            while (remaining > 0 && bank.allocated < bank.availableCount) {
              bank.allocated += 1;
              remaining -= 1;
            }
          });
        }

        weighted.forEach(bank => {
          allocations[bank.bloomLevel] = bank.allocated;
        });

        return allocations;
      };

      try {
        if (!jobData) {
          throw new NotFoundError(`Job with ID ${jobId} not found`);
        }
        let allQuestionsData: any[] = [];
        const uploadParams =
          (jobState.parameters as UploadParameters) ?? jobData.uploadParameters;
        const curatedQuestions = uploadParams?.questions;

        // Prefer curated questions from the upload payload when provided.
        if (Array.isArray(curatedQuestions) && curatedQuestions.length > 0) {
          allQuestionsData = curatedQuestions;
        } else {
          // Fallback to generated questions file when no curated payload is provided.
          try {
            const agent =
              appConfig.isProduction || appConfig.isStaging
                ? new SocksProxyAgent(aiConfig.proxyAddress)
                : undefined;

            const axiosOptions = {
              httpAgent: agent,
              httpsAgent: agent,
            };

            const response = await axios.get(jobState.file, axiosOptions);
            if (response.data) {
              allQuestionsData = response.data;
            } else {
              throw new Error(
                'JSON file must contain segmentsMap and questionsData',
              );
            }
          } catch (error) {
            throw new Error(
              `Failed to fetch or parse questions file from URL: ${jobState.file}. Error: ${error}`,
            );
          }
        }
        const questionsGroupedBySegment: Record<string, any[]> = {};
        if (Array.isArray(allQuestionsData)) {
          for (const question of allQuestionsData) {
            const segId = (question as any).segmentId;
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
          bloomLevel: string;
          questionCount: number;
          questionIds: string[];
        }> = [];

        let previousSegmentEndTime = 0.0;

        for (const currentSegmentId of jobState.segmentMap) {
          const segmentStartTime = previousSegmentEndTime;
          const currentSegmentEndTime = currentSegmentId;

          // Create Video Item for the segment
          const videoSegName = jobData.uploadParameters.videoItemBaseName
            ? jobData.uploadParameters.videoItemBaseName
            : `Video`;

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
          const questionsForSegment =
            questionsGroupedBySegment[currentSegmentId] || [];
          if (questionsForSegment.length > 0) {
            // Always enable Smart Bloom mode if flag is set, regardless of Bloom level tags
            const isSmartBloom = !!(
              jobData.questionGenerationParameters?.smartBloom?.enabled ||
              uploadParams?.smartBloomEnabled
            );

            if (isSmartBloom) {
              // Initialize bloom level buckets
              const questionsGroupedByBloom: Record<BloomLevelKey, any[]> = {
                knowledge: [],
                understanding: [],
                application: [],
                analysis: [],
                evaluation: [],
                creation: [],
                unclassified: [],
              };

              // First pass: group by existing Bloom levels
              for (const question of questionsForSegment) {
                const bloomLevel = extractBloomLevel(question);
                questionsGroupedByBloom[bloomLevel].push(question);
              }

              // Second pass: redistribute unclassified questions across all Bloom levels
              // using weighted distribution to match instructor's intended Bloom percentages
              if (questionsGroupedByBloom.unclassified.length > 0) {
                const bloomDistribution = jobData.questionGenerationParameters?.smartBloom?.distribution || {
                  knowledge: 40,
                  understanding: 35,
                  application: 25,
                  analysis: 0,
                  evaluation: 0,
                  creation: 0,
                };

                // Calculate total distribution percentage
                const totalDistPercent = Object.values(bloomDistribution).reduce((sum, pct) => sum + pct, 0);
                const bloomLevels: BloomLevelKey[] = ['knowledge', 'understanding', 'application', 'analysis', 'evaluation', 'creation'];

                // Distribute unclassified questions based on the distribution percentages
                const unclassifiedQuestions = questionsGroupedByBloom.unclassified;
                let qIndex = 0;

                for (const bloomLevel of bloomLevels) {
                  const distribution = bloomDistribution[bloomLevel] || 0;
                  if (distribution === 0) continue;

                  // Calculate how many unclassified questions should go to this level
                  const proportion = distribution / totalDistPercent;
                  const countForThisLevel = Math.round(proportion * unclassifiedQuestions.length);

                  for (let i = 0; i < countForThisLevel && qIndex < unclassifiedQuestions.length; i++) {
                    questionsGroupedByBloom[bloomLevel].push(unclassifiedQuestions[qIndex]);
                    qIndex++;
                  }
                }

                // Assign remaining questions using round-robin as fallback
                if (qIndex < unclassifiedQuestions.length) {
                  let fallbackIndex = 0;
                  for (; qIndex < unclassifiedQuestions.length; qIndex++) {
                    const assignedBloom = bloomLevels[fallbackIndex % bloomLevels.length];
                    questionsGroupedByBloom[assignedBloom].push(unclassifiedQuestions[qIndex]);
                    fallbackIndex++;
                  }
                }

                questionsGroupedByBloom.unclassified = [];
              }

              const segmentQuestionBanks: Array<{
                id: string;
                bloomLevel: BloomLevelKey;
                questionCount: number;
              }> = [];
              let totalQuestionsForSegment = 0;

              // Create a Question Bank for EVERY Bloom level (including empty ones for consistency)
              const allBloomLevels: BloomLevelKey[] = [
                'knowledge',
                'understanding',
                'application',
                'analysis',
                'evaluation',
                'creation',
              ];

              for (const bloomLevel of allBloomLevels) {
                const bloomQuestions = questionsGroupedByBloom[bloomLevel] || [];
                const questionBankName = `Question Bank - Segment (${segmentStartTime} - ${currentSegmentEndTime}) - ${bloomLevel.toUpperCase()}`;
                const questionBank = new QuestionBank({
                  title: questionBankName,
                  description: `Question bank for video segment from ${segmentStartTime} to ${currentSegmentEndTime} (Bloom: ${bloomLevel}).`,
                  courseId: new ObjectId(
                    (jobState.parameters as UploadParameters).courseId,
                  ),
                  courseVersionId: new ObjectId(
                    (jobState.parameters as UploadParameters).versionId,
                  ),
                  questions: [],
                  tags: [
                    `segment_${currentSegmentId}`,
                    `bloom_${bloomLevel}`,
                    'ai_generated',
                  ],
                  points: 5,
                });

                const questionBankId = await this.questionBankService.create(
                  questionBank,
                );

                const createdQuestionIds: string[] = [];
                for (const questionData of bloomQuestions) {
                  try {
                    const hint = questionData?.question?.hint;
                    const MAX_HINT_LENGTH = 80;
                    const safeHint =
                      hint && typeof hint === 'string' && hint.length > MAX_HINT_LENGTH
                        ? hint.substring(0, MAX_HINT_LENGTH - 3) + '...'
                        : hint;

                    const questionnew = QuestionFactory.createQuestion(
                      {
                        question: {
                          ...questionData.question,
                          hint: safeHint,
                          bloomLevel,
                          points: questionData.question.points || 5,
                        },
                        solution: questionData.solution,
                      },
                      jobData.userId.toString(),
                    );

                    const questionId = await this.questionService.create(
                      questionnew,
                    );
                    createdQuestionIds.push(questionId);

                    await this.questionBankService.addQuestion(
                      questionBankId,
                      questionId,
                    );
                  } catch (questionError) {
                    console.warn(
                      `Failed to create question for segment ${currentSegmentId} and bloom ${bloomLevel}:`,
                      questionError,
                    );
                  }
                }

                totalQuestionsForSegment += createdQuestionIds.length;
                segmentQuestionBanks.push({
                  id: questionBankId,
                  bloomLevel,
                  questionCount: createdQuestionIds.length,
                });

                createdQuestionBanksInfo.push({
                  id: questionBankId,
                  name: questionBankName,
                  segmentId: String(currentSegmentId),
                  bloomLevel,
                  questionCount: createdQuestionIds.length,
                  questionIds: createdQuestionIds,
                });
              }

            const quizSegName = jobData.uploadParameters.quizItemBaseName
              ? jobData.uploadParameters.quizItemBaseName
              : `Quiz`;

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
                allowSkip: false,
                allowHint: true,
                showCorrectAnswersAfterSubmission: true,
                showExplanationAfterSubmission: true,
                showScoreAfterSubmission: true,
                questionVisibility: totalQuestionsForSegment,
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

            // Link each Bloom-specific QuestionBank to the Quiz
            const quizId = createdQuizItem.createdItem?._id?.toString();
            if (quizId) {
              const bloomCountsForAttempt = allocateBloomCountsForAttempt(
                segmentQuestionBanks.map(bank => ({
                  bloomLevel: bank.bloomLevel,
                  availableCount: bank.questionCount,
                })),
                jobData.questionGenerationParameters?.smartBloom?.distribution,
              );

              for (const bank of segmentQuestionBanks) {
                try {
                  await this.quizService.addQuestionBank(quizId, {
                    bankId: bank.id,
                    count: bloomCountsForAttempt[bank.bloomLevel],
                    tags: [`bloom_${bank.bloomLevel}`, 'ai_generated'],
                  });
                } catch (linkError) {
                  console.warn(
                    `Failed to link question bank ${bank.id} to quiz ${quizId}:`,
                    linkError,
                  );
                }
              }
            }

            createdQuizItemsInfo.push({
              id: createdQuizItem.createdItem?._id?.toString(),
              name: quizSegName,
              segmentId: String(currentSegmentId),
              questionCount: totalQuestionsForSegment,
            });
            } else {
              // Original single-bank path (AiWorkflow and other non-SmartBloom workflows)
              const legacyBankName = `Question Bank - Segment (${segmentStartTime} - ${currentSegmentEndTime})`;
              const legacyQuestionBank = new QuestionBank({
                title: legacyBankName,
                description: `Question bank for video segment from ${segmentStartTime} to ${currentSegmentEndTime}.`,
                courseId: new ObjectId(
                  (jobState.parameters as UploadParameters).courseId,
                ),
                courseVersionId: new ObjectId(
                  (jobState.parameters as UploadParameters).versionId,
                ),
                questions: [],
                tags: [`segment_${currentSegmentId}`, 'ai_generated'],
                points: 5,
              });

              const legacyBankId = await this.questionBankService.create(
                legacyQuestionBank,
              );

              const legacyQuestionIds: string[] = [];
              for (const questionData of questionsForSegment) {
                try {
                  const hint = questionData?.question?.hint;
                  const MAX_HINT_LENGTH = 80;
                  const safeHint =
                    hint &&
                    typeof hint === 'string' &&
                    hint.length > MAX_HINT_LENGTH
                      ? hint.substring(0, MAX_HINT_LENGTH - 3) + '...'
                      : hint;

                  const legacyQuestion = QuestionFactory.createQuestion(
                    {
                      question: {
                        ...questionData.question,
                        hint: safeHint,
                        points: questionData.question.points || 5,
                      },
                      solution: questionData.solution,
                    },
                    jobData.userId.toString(),
                  );

                  const questionId = await this.questionService.create(
                    legacyQuestion,
                  );
                  legacyQuestionIds.push(questionId);

                  await this.questionBankService.addQuestion(
                    legacyBankId,
                    questionId,
                  );
                } catch (questionError) {
                  console.warn(
                    `Failed to create question for segment ${currentSegmentId}:`,
                    questionError,
                  );
                }
              }

              const legacyQuizName = jobData.uploadParameters.quizItemBaseName
                ? jobData.uploadParameters.quizItemBaseName
                : `Quiz`;

              const legacyQuizItemBody: CreateItemBody = {
                name: legacyQuizName,
                description: `Quiz for video segment from ${segmentStartTime} to ${currentSegmentEndTime}. This quiz's points are based on its questions.`,
                type: ItemType.QUIZ,
                quizDetails: {
                  passThreshold: 0.7,
                  maxAttempts: 1000,
                  quizType: 'NO_DEADLINE',
                  approximateTimeToComplete: '00:05:00',
                  allowPartialGrading: true,
                  allowSkip: false,
                  allowHint: true,
                  showCorrectAnswersAfterSubmission: true,
                  showExplanationAfterSubmission: true,
                  showScoreAfterSubmission: true,
                  questionVisibility: legacyQuestionIds.length,
                  releaseTime: new Date(),
                  deadline: undefined,
                },
              };

              const legacyQuizItem = await this.itemService.createItem(
                (jobState.parameters as UploadParameters).versionId,
                (jobState.parameters as UploadParameters).moduleId,
                (jobState.parameters as UploadParameters).sectionId,
                legacyQuizItemBody,
              );

              const legacyQuizId = legacyQuizItem.createdItem?._id?.toString();
              if (legacyQuizId) {
                await this.quizService.addQuestionBank(legacyQuizId, {
                  bankId: legacyBankId,
                  count: jobData.uploadParameters.questionsPerQuiz ?? 2,
                  tags: ['AI Generated'],
                });
              }

              createdQuestionBanksInfo.push({
                id: legacyBankId,
                name: legacyBankName,
                segmentId: String(currentSegmentId),
                bloomLevel: 'n/a',
                questionCount: legacyQuestionIds.length,
                questionIds: legacyQuestionIds,
              });

              createdQuizItemsInfo.push({
                id: legacyQuizItem.createdItem?._id?.toString(),
                name: legacyQuizName,
                segmentId: String(currentSegmentId),
                questionCount: legacyQuestionIds.length,
              });
            }
          }

          previousSegmentEndTime = currentSegmentEndTime;
        }
        jobData.jobStatus.uploadContent = TaskStatus.COMPLETED;
        const taskDAta = await this.genAIRepository.getTaskDataByJobId(
          jobId,
          session,
        );

        // Publish the approved concept map (if this job generated one):
        // resolve each node's segment anchor to the video item that segment
        // just became. Failure here must never fail the upload itself.
        try {
          await this.publishConceptMap(
            jobId,
            jobData,
            jobState,
            taskDAta,
            createdVideoItemsInfo,
            createdQuizItemsInfo,
            session,
          );
        } catch (error) {
          console.error(
            `Failed to publish concept map for job ${jobId} (upload unaffected):`,
            error,
          );
        }

        if (!taskDAta.uploadContent) {
          taskDAta.uploadContent = [{ status: TaskStatus.COMPLETED }];
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
            totalQuestionsGenerated: createdQuestionBanksInfo.reduce(
              (sum, bank) => sum + bank.questionCount,
              0,
            ),
          },
          createdVideoItems: createdVideoItemsInfo,
          createdQuizItems: createdQuizItemsInfo,
          createdQuestionBanks: createdQuestionBanksInfo,
        };
      } catch (error) {
        jobData.jobStatus.uploadContent = TaskStatus.FAILED;
        await this.genAIRepository.update(jobId, jobData, session);
        const taskDAta = await this.genAIRepository.getTaskDataByJobId(
          jobId,
          session,
        );
        if (!taskDAta) {
          throw new NotFoundError(`Task data for job ID ${jobId} not found`);
        }
        if (!taskDAta.uploadContent) {
          taskDAta.uploadContent = [
            { status: TaskStatus.FAILED, error: error.message },
          ];
        }
        taskDAta.uploadContent.push({
          status: TaskStatus.FAILED,
          error: error.message,
        });
        await this.genAIRepository.updateTaskData(jobId, taskDAta, session);
        console.error(`Error during content upload for job ${jobId}:`, error);
        throw new InternalServerError(
          `Failed to upload content for job ${jobId}: ${error.message}`,
        );
      }
    });
  }

  private async publishConceptMap(
    jobId: string,
    jobData: GenAIBody,
    jobState: JobState,
    taskData: TaskData,
    createdVideoItemsInfo: Array<{ id?: string; segmentId: string }>,
    createdQuizItemsInfo: Array<{ id?: string; segmentId: string }>,
    session: any,
  ): Promise<void> {
    const latestMap = taskData.conceptMap
      ?.filter(m => m.status === TaskStatus.COMPLETED && m.nodes?.length)
      .pop();
    if (!latestMap) {
      return; // job has no approved map — feature is additive, skip silently
    }
    const uploadParams =
      (jobState.parameters as UploadParameters) ?? jobData.uploadParameters;

    // Nodes are anchored to the SEGMENTATION task's map; the upload loop may
    // run on a slightly different rendering of the same boundaries (e.g.
    // rounded values in segmentMapUsed). Segment ORDER is the stable
    // identity, so resolve node → item by segment index in the map the
    // concepts were generated against, falling back to nearest-boundary if
    // the counts ever diverge (e.g. teacher edited the segment map between
    // tasks).
    const conceptSegMap =
      taskData.segmentation?.[taskData.segmentation.length - 1]
        ?.segmentationMap ?? jobState.segmentMap ?? [];
    const uploadSegMap = jobState.segmentMap ?? [];

    const segmentIndexForNode = (segmentEnd: number): number => {
      let index = conceptSegMap.findIndex(v => v === segmentEnd);
      if (index < 0 || index >= createdVideoItemsInfo.length) {
        let best = -1;
        let bestDist = Number.POSITIVE_INFINITY;
        uploadSegMap.forEach((v, i) => {
          const dist = Math.abs(Number(v) - segmentEnd);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        index = best;
      }
      return index;
    };
    const itemForNode = (segmentEnd: number): string | undefined => {
      const index = segmentIndexForNode(segmentEnd);
      return index >= 0 ? createdVideoItemsInfo[index]?.id : undefined;
    };
    // Quiz items only exist for segments that received questions, so they
    // are looked up by the segment value they were created for — not by
    // position in createdQuizItemsInfo.
    const quizBySegmentId = new Map(
      createdQuizItemsInfo.map(q => [q.segmentId, q.id]),
    );
    const quizForNode = (segmentEnd: number): string | undefined => {
      const index = segmentIndexForNode(segmentEnd);
      if (index < 0 || index >= uploadSegMap.length) return undefined;
      return quizBySegmentId.get(String(uploadSegMap[index]));
    };
    const conceptSegStart = (segmentEnd: number): number => {
      const index = conceptSegMap.findIndex(v => v === segmentEnd);
      return index > 0 ? Number(conceptSegMap[index - 1]) : 0;
    };

    const map: ConceptMap = {
      jobId,
      courseId: uploadParams.courseId,
      versionId: uploadParams.versionId,
      moduleId: uploadParams.moduleId,
      sectionId: uploadParams.sectionId,
      nodes: latestMap.nodes.map(n => {
        const offset =
          typeof n.anchorSeconds === 'number'
            ? Math.max(0, n.anchorSeconds - conceptSegStart(n.segmentEnd))
            : 0;
        return {
          id: n.id,
          label: n.label,
          description: n.description,
          segmentEnd: n.segmentEnd,
          videoItemId: itemForNode(n.segmentEnd),
          quizItemId: quizForNode(n.segmentEnd),
          offsetSeconds: Math.round(offset * 1000) / 1000,
        };
      }),
      edges: (latestMap.edges ?? []).map(e => ({ from: e.from, to: e.to })),
      fallback: latestMap.fallback,
      modelUsed: latestMap.modelUsed,
      createdAt: new Date(),
    };
    await this.conceptMapRepository.upsertForJob(map, session);
  }
}
