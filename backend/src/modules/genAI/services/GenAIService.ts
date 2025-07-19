import { injectable, inject } from 'inversify';
import { WebhookService } from './WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { JobBody } from '../classes/validators/GenAIValidators.js';
import { GenAIRepository } from '../repositories/providers/mongodb/GenAIRepository.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ItemType, MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { BadRequestError, InternalServerError, NotFoundError } from 'routing-controllers';
import { audioData, contentUploadData, JobState, questionGenerationData, QuestionGenerationParameters, segmentationData, SegmentationParameters, TaskData, TaskStatus, TaskType, TranscriptParameters, trascriptGenerationData, UploadParameters } from '../classes/transformers/GenAI.js';
import { QuestionFactory } from '#root/modules/quizzes/classes/index.js';
import { CreateItemBody } from '#root/modules/courses/classes/index.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';
import { ItemService } from '#root/modules/courses/services/ItemService.js';
import { QuestionBank } from '#root/modules/quizzes/classes/transformers/QuestionBank.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { QuestionBankService, QuizService } from '#root/modules/quizzes/services/index.js';
import { QuestionService } from '#root/modules/quizzes/services/QuestionService.js';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig } from '#root/config/ai.js';

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
  ) {
    super(mongoDatabase);
  }

  /**
   * Start a new genAI job
   * @param jobData Job configuration data
   * @returns Created job data
   */
  async startJob(userId: string, jobData: JobBody): Promise<{ jobId: string }> {
    return this._withTransaction(async session => {
      // Prepare job data and send to AI server]
      const result = await this.webhookService.AIServerCheck();
      if (result !== 200) {
        throw new Error('Failed to connect to AI server');
      }
      const jobId = await this.genAIRepository.save(userId, jobData, session)
      await this.genAIRepository.createTaskData(jobId, session);

      return {jobId};
    });
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
      jobState.parameters = {...jobState.parameters, ...parameters};
      if (jobState.taskStatus == TaskStatus.COMPLETED) {
        throw new BadRequestError(`The task ${jobState.currentTask} for job ID ${jobId} is already completed, you can either rerun the task or approve to move to the next taask.`);
      }
      if (jobState.currentTask === TaskType.UPLOAD_CONTENT) {
        return await this.uploadContent(jobId, jobState);
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
      if (jobState.taskStatus !== TaskStatus.COMPLETED && jobState.taskStatus !== TaskStatus.FAILED) {
        throw new BadRequestError(`The task ${jobState.currentTask} for job ID ${jobId} has not been completed yet, please approve the task to start.`);
      }
      jobState.parameters = {...jobState.parameters, ...parameters};
      if (jobState.currentTask === TaskType.UPLOAD_CONTENT) {
        return await this.uploadContent(jobId, jobState);
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
      if (jobData.status === TaskStatus.COMPLETED || jobData.status === TaskStatus.FAILED) {
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
      if (job.jobStatus.audioExtraction === TaskStatus.WAITING || job.jobStatus.audioExtraction === TaskStatus.COMPLETED || job.jobStatus.audioExtraction === TaskStatus.FAILED) {
        jobState.currentTask = TaskType.AUDIO_EXTRACTION;
        if (job.jobStatus.audioExtraction === TaskStatus.WAITING) jobState.currentTask = null;
        jobState.taskStatus = job.jobStatus.audioExtraction;
        jobState.url = job.url;
      }
      if (job.jobStatus.transcriptGeneration === TaskStatus.WAITING || job.jobStatus.transcriptGeneration === TaskStatus.COMPLETED || job.jobStatus.transcriptGeneration === TaskStatus.FAILED) {
        jobState.currentTask = TaskType.TRANSCRIPT_GENERATION;
        if (job.jobStatus.transcriptGeneration === TaskStatus.WAITING) jobState.currentTask = TaskType.AUDIO_EXTRACTION;
        jobState.taskStatus = job.jobStatus.transcriptGeneration;
        jobState.parameters = job.transcriptParameters;
        jobState.file = task.audioExtraction[usePrevious ? usePrevious : 0]?.fileUrl;
      }
      if (job.jobStatus.segmentation === TaskStatus.WAITING || job.jobStatus.segmentation === TaskStatus.COMPLETED || job.jobStatus.segmentation === TaskStatus.FAILED) {
        jobState.currentTask = TaskType.SEGMENTATION;
        if (job.jobStatus.segmentation === TaskStatus.WAITING) jobState.currentTask = TaskType.TRANSCRIPT_GENERATION;
        jobState.taskStatus = job.jobStatus.segmentation;
        jobState.parameters = job.segmentationParameters;
        jobState.file = task.transcriptGeneration[usePrevious ? usePrevious : 0]?.fileUrl;
      }
      if (job.jobStatus.questionGeneration === TaskStatus.WAITING || job.jobStatus.questionGeneration === TaskStatus.COMPLETED || job.jobStatus.questionGeneration === TaskStatus.FAILED) {
        jobState.currentTask = TaskType.QUESTION_GENERATION;
        if (job.jobStatus.questionGeneration === TaskStatus.WAITING) jobState.currentTask = TaskType.SEGMENTATION;
        jobState.taskStatus = job.jobStatus.questionGeneration;
        jobState.parameters = job.questionGenerationParameters;
        jobState.file = null;
        jobState.segmentMap = task.segmentation[usePrevious ? usePrevious : 0]?.segmentationMap;
      }
      // if all the previous task are completed
      if (job.jobStatus.audioExtraction === TaskStatus.COMPLETED && job.jobStatus.transcriptGeneration === TaskStatus.COMPLETED && job.jobStatus.segmentation === TaskStatus.COMPLETED && job.jobStatus.questionGeneration === TaskStatus.COMPLETED && job.jobStatus.uploadContent === TaskStatus.WAITING) {
        console.log("All previous tasks completed, setting current task to UPLOAD_CONTENT");
        jobState.currentTask = TaskType.UPLOAD_CONTENT
        jobState.taskStatus = job.jobStatus.uploadContent;
        jobState.parameters = job.uploadParameters;
        jobState.file = task.questionGeneration[usePrevious ? usePrevious : 0].fileUrl
        jobState.segmentMap = task.questionGeneration[usePrevious ? usePrevious : 0].segmentMapUsed;
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
          const agent = aiConfig.proxyAddress ? new SocksProxyAgent(aiConfig.proxyAddress) : undefined;

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
            // Handle numeric segmentId matching with floating point precision
            const segIdStr = segId?.toString();
            const segIdKey = Object.keys(jobState.segmentMap).find(key => 
              Math.abs(parseFloat(key) - parseFloat(segIdStr)) < 0.001 || key === segIdStr
            );
            
            if (segIdKey && jobState.segmentMap[segIdKey]) {
              if (!questionsGroupedBySegment[segIdKey]) {
                questionsGroupedBySegment[segIdKey] = [];
              }
              questionsGroupedBySegment[segIdKey].push(question);
            } else {
              console.warn(
                `Question found without a valid segmentId ("${segId}") or segmentId not in segmentsMap.`,
                question,
              );
            }
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

        // Helper function to convert time strings (like "5:15" or "1:02:30") to seconds for correct sorting
        const timeToSeconds = (timeStr: string): number => {
          const parts = timeStr.split(':').map(Number).reverse(); // [ss, mm, hh]
          let seconds = 0;
          if (parts[0]) seconds += parts[0]; // seconds
          if (parts[1]) seconds += parts[1] * 60; // minutes
          if (parts[2]) seconds += parts[2] * 3600; // hours
          return seconds;
        };

        const sortedSegmentIds = Object.keys(jobState.segmentMap).sort((a, b) =>
          timeToSeconds(a) - timeToSeconds(b)
        );
        let previousSegmentEndTime = '0:00:00';

        for (const currentSegmentId of sortedSegmentIds) {
          const segmentText = jobState.segmentMap[currentSegmentId];
          const segmentStartTime = previousSegmentEndTime;
          const currentSegmentEndTime = currentSegmentId;
          const segmentTextPreview = segmentText
            ? segmentText.substring(0, 70) +
              (segmentText.length > 70 ? '...' : '')
            : 'No content';

          // Create Video Item for the segment
          const videoSegName = jobData.uploadParameters.videoItemBaseName;

          const videoItemBody: CreateItemBody = {
            name: videoSegName,
            description: `Video content`,
            type: ItemType.VIDEO,
            videoDetails: {
              URL: jobData.url,
              startTime: segmentStartTime,
              endTime: currentSegmentEndTime,
              points: 10,
            },
          };
          const createdVideoItem = await this.itemService.createItem(
            jobData.uploadParameters.versionId,
            jobData.uploadParameters.moduleId,
            jobData.uploadParameters.sectionId,
            videoItemBody,
          );
                  createdVideoItemsInfo.push({
            id: createdVideoItem.createdItem?._id?.toString(),
            name: videoSegName,
            segmentId: currentSegmentId,
            startTime: segmentStartTime,
            endTime: currentSegmentEndTime,
            points: 10,
          });

          // Create Question Bank and Questions for the segment
          const questionsForSegment = questionsGroupedBySegment[currentSegmentId] || [];
          if (questionsForSegment.length > 0) {
                      // Create Question Bank for this segment
            const questionBankName = `Question Bank - Segment (${segmentStartTime} - ${currentSegmentEndTime})`;
            const questionBank = new QuestionBank({
              title: questionBankName,
              description: `Question bank for video segment from ${segmentStartTime} to ${currentSegmentEndTime}. Content: "${segmentTextPreview}"`,
              courseId: jobData.uploadParameters.courseId,
              courseVersionId: jobData.uploadParameters.versionId,
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
              segmentId: currentSegmentId,
              questionCount: createdQuestionIds.length,
              questionIds: createdQuestionIds,
            });

            const quizSegName = jobData.uploadParameters.quizItemBaseName;

            const quizItemBody: CreateItemBody = {
              name: quizSegName,
              description: `Quiz for video segment from ${segmentStartTime} to ${currentSegmentEndTime}. Content: "${segmentTextPreview}". This quiz's points are based on its questions.`,
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
              jobData.uploadParameters.versionId,
              jobData.uploadParameters.moduleId,
              jobData.uploadParameters.sectionId,
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
              segmentId: currentSegmentId,
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
            totalSegmentsProcessed: sortedSegmentIds.length,
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