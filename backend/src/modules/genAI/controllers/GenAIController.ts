import { injectable, inject } from "inversify";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { 
  Body, 
  JsonController, 
  Params, 
  Post, 
  Get, 
  HttpCode,
  Authorized,
  UploadedFile,
  ForbiddenError,
  OnUndefined,
  Patch,
  Req,
  Res,
} from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import {
  JobBody,
  GenAIIdParams,
  ApproveStartBody,
  GenAIResponse,
  GenAINotFoundErrorResponse,
  RerunTaskBody,
  JobStatusResponse,
  EditSegmentMapBody,
  EditQuestionData,
  TaskStatusParams,
  EditTranscript,
} from '../classes/validators/GenAIValidators.js';
import { GenAIService } from '../services/GenAIService.js';
import { WebhookService } from '../services/WebhookService.js';
import { GENAI_TYPES } from '../types.js';
import { BadRequestErrorResponse } from "#root/shared/index.js";
import { Ability } from "#root/shared/functions/AbilityDecorator.js";
import { getGenAIAbility } from "../abilities/genAIAbilities.js";
import { subject } from "@casl/ability";
import { SseService } from "../services/sseService.js";

@OpenAPI({
  tags: ['GenAI'],
  description: 'Operations for managing genAI',
})
@injectable()
@JsonController('/genai')
export class GenAIController {
  constructor(
    @inject(GENAI_TYPES.GenAIService)
    private readonly genAIService: GenAIService,
    @inject(GENAI_TYPES.WebhookService)
    private readonly webhookService: WebhookService,
    @inject(GENAI_TYPES.SseService)
    private readonly sseService: SseService
  ) {}

  @OpenAPI({
    summary: 'Start a new job',
    description: 'Starts a new genAI process. Can be of type Video or Playlist.',
  })
  @Post("/jobs")
  @Authorized()
  @HttpCode(201)
  @ResponseSchema(GenAIResponse, {
    description: 'GenAI job created successfully'
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async start(@Body() body: JobBody, @Ability(getGenAIAbility) {ability, user}) {

    const genaiRes = subject('GenAI', { courseId: body.uploadParameters.courseId, versionId: body.uploadParameters.versionId });
    if (!ability.can('create', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to create a genAI job');
    }

    return await this.genAIService.startJob(user._id.toString(), body);
  }

  @OpenAPI({
    summary: 'Start a new job',
    description: 'Starts a new genAI process. Audio file provided.',
  })
  @Post("/jobs/audio-provided")
  @Authorized()
  @HttpCode(201)
  @ResponseSchema(GenAIResponse, {
    description: 'GenAI job created successfully'
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async startWithAudio(
    @UploadedFile("file")
          file: Express.Multer.File,
    @Body() body: JobBody, @Ability(getGenAIAbility) {ability, user}) {

    const genaiRes = subject('GenAI', { courseId: body.uploadParameters.courseId, versionId: body.uploadParameters.versionId });
    if (!ability.can('create', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to create a genAI job');
    }

    return await this.genAIService.startJob(user._id.toString(), body, file);
  }

  @OpenAPI({
    summary: 'Get job status',
    description: 'Retrieves the current status of a job by ID.',
  })
  @Get("/jobs/:id")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(JobStatusResponse, {
    description: 'Job retrieved successfully'
  })
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'Job not found',
    statusCode: 404,
  })
  async getStatus(@Params() params: GenAIIdParams, @Ability(getGenAIAbility) {ability}) {
    const { id } = params;
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to view this genAI');
    }

    const result = await this.genAIService.getJobStatus(id);

    return result;
  }

  @OpenAPI({
    summary: 'Get task status',
    description: 'Retrieves the status of a specific task in a job.',
  })
  @Get("/:id/tasks/:type/status")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'Job not found',
    statusCode: 404,
  })
  async getTaskStatus(@Params() params: TaskStatusParams, @Ability(getGenAIAbility) {ability}) {
    const { id, type } = params;
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to view this genAI');
    }

    const result = await this.genAIService.getTaskStatus(id, type);

    return result;
  }

  @OpenAPI({
    summary: 'Approve task to start',
    description: 'Approve the task to start running, optionally with given parameters.',
  })
  @Post("/:id/tasks/approve/start")
  @Authorized()
  @OnUndefined(200)
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'Job not found',
    statusCode: 404,
  })
  async approveStart(@Params() params: GenAIIdParams, @Body() body: ApproveStartBody, @Ability(getGenAIAbility) {ability, user}) {
    const { id } = params;
    const userId = user._id.toString();
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to approve tasks in this genAI');
    }

    await this.genAIService.approveTaskToStart(id, userId, body.usePrevious, body.parameters);
  }

  @OpenAPI({
    summary: 'Approve task and continue',
    description: 'Approve the task\'s output and continue to the next task.',
  })
  @Authorized()
  @OnUndefined(200)
  @Post("/:id/tasks/approve/continue")
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'Job not found',
    statusCode: 404,
  })
  async approveContinue(@Params() params: GenAIIdParams, @Ability(getGenAIAbility) {ability}) {
    const { id } = params;
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to approve tasks in this genAI');
    }

    await this.genAIService.approveTaskContinue(id);
  }

  @OpenAPI({
    summary: 'Rerun current task',
    description: 'Reruns the current task in the job.',
  })
  @Post("/jobs/:id/tasks/rerun")
  @Authorized()
  @OnUndefined(200)
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'GenAI not found',
    statusCode: 404,
  })
  async rerunTask(@Params() params: GenAIIdParams, @Body() body: RerunTaskBody, @Ability(getGenAIAbility) {ability, user}) {
    const { id } = params;
    const userId = user._id.toString();
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to rerun tasks in this job');
    }

    await this.genAIService.rerunTask(id, userId, body.usePrevious, body.parameters);
  }

  @OpenAPI({
    summary: 'Abort current task',
    description: 'Aborts the current task in the job.',
  })
  @Post("/jobs/:id/tasks/abort")
  @Authorized()
  @OnUndefined(200)
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'GenAI not found',
    statusCode: 404,
  })
  async abortTask(@Params() params: GenAIIdParams, @Ability(getGenAIAbility) {ability, user}) {
    const { id } = params;
    const userId = user._id.toString();
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to abort tasks in this job');
    }

    await this.genAIService.abortTask(id);
  }

  @OpenAPI({
    summary: 'Edit segment map',
    description: 'Edits the segment map of a job.',
  })
  @Patch("/jobs/:id/edit/segment-map")
  @Authorized()
  @OnUndefined(200)
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'GenAI not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ForbiddenError, {
    description: 'Forbidden Error',
    statusCode: 403,
  })
  async editSegmentMap(@Params() params: GenAIIdParams, @Body() body: EditSegmentMapBody, @Ability(getGenAIAbility) {ability}) {
    const { id } = params;
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to edit the segment map of this job');
    }
    
    await this.genAIService.editSegmentMap(id, body.segmentMap, body.index);
  }

  @OpenAPI({
    summary: 'Edit question data',
    description: 'Edits the question data of a job.',
  })
  @Patch("/jobs/:id/edit/question")
  @Authorized()
  @OnUndefined(200)
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'GenAI not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ForbiddenError, {
    description: 'Forbidden Error',
    statusCode: 403,
  })
  async editQuestionData(@Params() params: GenAIIdParams, @Body() body: EditQuestionData, @Ability(getGenAIAbility) {ability}) {
    const { id } = params;
    const { questionData, index } = body;
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to edit question data of this job');
    }

    await this.genAIService.editQuestionData(id, questionData, index);
  }

  @OpenAPI({
    summary: 'Edit transcript',
    description: 'Edits the transcript of a job.',
  })
  @Patch("/jobs/:id/edit/transcript")
  @Authorized()
  @OnUndefined(200)
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'GenAI not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ForbiddenError, {
    description: 'Forbidden Error',
    statusCode: 403,
  })
  async editTranscript(@Params() params: GenAIIdParams, @Body() body: EditTranscript, @Ability(getGenAIAbility) {ability}) {
    const { id } = params;
    const { transcript, index } = body;
    const job = await this.genAIService.getJobStatus(id);

    const genaiRes = subject('GenAI', { courseId: job.uploadParameters.courseId, versionId: job.uploadParameters.versionId });
    if (!ability.can('modify', genaiRes)) {
      //throw new ForbiddenError('You do not have permission to edit transcript of this job');
    }

    await this.genAIService.editTranscript(id, transcript, index);
  }

  @OpenAPI({
    summary: 'Get live status updates',
    description: 'Establishes a Server-Sent Events (SSE) connection to receive live status updates for a job.',
  })
  @Get("/:id/live")
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'GenAI not found',
    statusCode: 404,
  })
  async getLiveUpdates(
    @Params() params: GenAIIdParams,
    @Res() res: Response,
    @Req() req: Request
  ) {
    const { id } = params;
    this.sseService.init(
      req as unknown as ExpressRequest,
      res as unknown as ExpressResponse,
      id
    );
  }
}