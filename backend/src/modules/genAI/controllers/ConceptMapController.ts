import { injectable, inject } from 'inversify';
import {
  JsonController,
  Get,
  Patch,
  Post,
  Params,
  Body,
  Authorized,
  HttpCode,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { subject } from '@casl/ability';
import {
  ConceptMapSectionParams,
  ConceptMapJobParams,
  ConceptMapResponse,
  ConceptMapProgressResponse,
  ConceptMapPreviewEditBody,
  GenAINotFoundErrorResponse,
} from '../classes/validators/GenAIValidators.js';
import { GENAI_TYPES } from '../types.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { SubmissionRepository } from '#root/modules/quizzes/repositories/providers/mongodb/SubmissionRepository.js';
import { GenAIService } from '../services/GenAIService.js';
import { bktMastery } from '../services/bkt.js';
import { ConceptMapRepository } from '../repositories/providers/mongodb/ConceptMapRepository.js';
import { TaskStatus, TaskType } from '../classes/transformers/GenAI.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { getGenAIAbility, ConceptMapActions } from '../abilities/genAIAbilities.js';
import { ForbiddenErrorResponse } from '#root/shared/index.js';

@OpenAPI({
  tags: ['ConceptMap'],
  description:
    'Read access to concept maps: published maps for students, in-pipeline previews for teachers.',
})
@injectable()
@JsonController('/concept-maps')
export class ConceptMapController {
  constructor(
    @inject(GENAI_TYPES.GenAIService)
    private readonly genAIService: GenAIService,
    @inject(GENAI_TYPES.ConceptMapRepo)
    private readonly conceptMapRepository: ConceptMapRepository,
    @inject(QUIZZES_TYPES.SubmissionRepo)
    private readonly submissionRepository: SubmissionRepository,
  ) {}

  @OpenAPI({
    summary: 'Get published concept maps for a section',
    description:
      'Returns the published concept maps whose lectures were uploaded into the given section. Requires enrollment in the course version.',
  })
  @Get('/section/:versionId/:sectionId')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(ConceptMapResponse, {
    isArray: true,
    description: 'Published concept maps for the section (empty array if none)',
  })
  @ResponseSchema(ForbiddenErrorResponse, {
    description: 'Not enrolled in this course version',
    statusCode: 403,
  })
  async getBySection(
    @Params() params: ConceptMapSectionParams,
    @Ability(getGenAIAbility) { ability },
  ) {
    const { versionId, sectionId } = params;
    const mapRes = subject('ConceptMap', { versionId });
    if (!ability.can(ConceptMapActions.View, mapRes)) {
      throw new ForbiddenError(
        'You must be enrolled in this course version to view its concept maps',
      );
    }
    return this.conceptMapRepository.getBySection(versionId, sectionId);
  }

  @OpenAPI({
    summary: "Get the requesting student's mastery outcomes for a section's concept maps",
    description:
      "Read-only join of the section's published concept maps against the student's own quiz submissions: per node, 'mastered' when the segment quiz was passed, 'weak' when attempted but not passed. Nodes without attempts (or without a quiz) are omitted.",
  })
  @Get('/section/:versionId/:sectionId/progress')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(ConceptMapProgressResponse, {
    isArray: true,
    description: 'Per-map node outcomes for the requesting student',
  })
  @ResponseSchema(ForbiddenErrorResponse, {
    description: 'Not enrolled in this course version',
    statusCode: 403,
  })
  async getSectionProgress(
    @Params() params: ConceptMapSectionParams,
    @Ability(getGenAIAbility) { ability, user },
  ) {
    const { versionId, sectionId } = params;
    const mapRes = subject('ConceptMap', { versionId });
    if (!ability.can(ConceptMapActions.View, mapRes)) {
      throw new ForbiddenError(
        'You must be enrolled in this course version to view its concept maps',
      );
    }

    const maps = await this.conceptMapRepository.getBySection(
      versionId,
      sectionId,
    );
    const quizIds = [
      ...new Set(
        maps.flatMap(map =>
          map.nodes.map(n => n.quizItemId).filter((id): id is string => !!id),
        ),
      ),
    ];
    const [quizOutcomes, answerSequences] = await Promise.all([
      this.submissionRepository.getOutcomesByQuizIds(
        user._id.toString(),
        quizIds,
      ),
      this.submissionRepository.getAnswerSequencesByQuizIds(
        user._id.toString(),
        quizIds,
      ),
    ]);

    return maps.map(map => {
      const outcomes: Record<string, 'mastered' | 'weak'> = {};
      const mastery: Record<string, number> = {};
      for (const node of map.nodes) {
        const outcome = node.quizItemId
          ? quizOutcomes[node.quizItemId]
          : undefined;
        if (outcome === 'PASSED') outcomes[node.id] = 'mastered';
        else if (outcome === 'ATTEMPTED') outcomes[node.id] = 'weak';
        // BKT mastery probability over the student's ordered answer history.
        const sequence = node.quizItemId
          ? answerSequences[node.quizItemId]
          : undefined;
        if (sequence?.length) {
          mastery[node.id] = Math.round(bktMastery(sequence) * 100) / 100;
        }
      }
      return { jobId: map.jobId, outcomes, mastery };
    });
  }

  @OpenAPI({
    summary: "Preview a job's in-pipeline concept map",
    description:
      'Returns the latest generated (not yet published) concept map of a GenAI job, for the teacher approval step. Allowed for the job creator and course staff.',
  })
  @Get('/job/:jobId/preview')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(ConceptMapResponse, {
    description: 'Latest in-pipeline concept map of the job',
  })
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'Job has no generated concept map',
    statusCode: 404,
  })
  async previewByJob(
    @Params() params: ConceptMapJobParams,
    @Ability(getGenAIAbility) { ability, user },
  ) {
    const { jobId } = params;
    const job = await this.genAIService.getJobStatus(jobId);

    const isCreator = job.userId?.toString() === user._id.toString();
    const mapRes = subject('ConceptMap', {
      courseId: job.uploadParameters.courseId,
      versionId: job.uploadParameters.versionId,
    });
    if (!isCreator && !ability.can(ConceptMapActions.Preview, mapRes)) {
      throw new ForbiddenError(
        'You do not have permission to preview this concept map',
      );
    }

    const attempts = await this.genAIService.getTaskStatus(
      jobId,
      TaskType.CONCEPT_MAP,
    );
    const latest = Array.isArray(attempts)
      ? [...attempts]
          .filter(a => a.status === TaskStatus.COMPLETED && a.nodes?.length)
          .pop()
      : undefined;
    if (!latest) {
      throw new NotFoundError(
        `No generated concept map found for job ${jobId}`,
      );
    }
    return {
      jobId,
      courseId: job.uploadParameters.courseId,
      versionId: job.uploadParameters.versionId,
      moduleId: job.uploadParameters.moduleId,
      sectionId: job.uploadParameters.sectionId,
      nodes: latest.nodes,
      edges: latest.edges ?? [],
      fallback: latest.fallback,
    };
  }

  @OpenAPI({
    summary: "Edit a job's in-pipeline concept map (remove one node)",
    description:
      'Teacher approval edit: removes one concept from the latest generated map. Incident edges drop and parent→child prerequisite chains are re-bridged, so one bad node no longer forces a full regeneration. Allowed for the job creator and course staff.',
  })
  @Patch('/job/:jobId/preview')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(ConceptMapResponse, {
    description: 'The edited concept map',
  })
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'Job has no generated concept map',
    statusCode: 404,
  })
  async editPreview(
    @Params() params: ConceptMapJobParams,
    @Body() body: ConceptMapPreviewEditBody,
    @Ability(getGenAIAbility) { ability, user },
  ) {
    const { jobId } = params;
    const job = await this.genAIService.getJobStatus(jobId);

    const isCreator = job.userId?.toString() === user._id.toString();
    const mapRes = subject('ConceptMap', {
      courseId: job.uploadParameters.courseId,
      versionId: job.uploadParameters.versionId,
    });
    if (!isCreator && !ability.can(ConceptMapActions.Preview, mapRes)) {
      throw new ForbiddenError(
        'You do not have permission to edit this concept map',
      );
    }

    const edited = await this.genAIService.editConceptMapPreview(
      jobId,
      body.removeNodeId,
    );
    return {
      jobId,
      courseId: job.uploadParameters.courseId,
      versionId: job.uploadParameters.versionId,
      moduleId: job.uploadParameters.moduleId,
      sectionId: job.uploadParameters.sectionId,
      nodes: edited.nodes,
      edges: edited.edges ?? [],
      fallback: edited.fallback,
    };
  }

  @OpenAPI({
    summary: 'Retroactively generate and publish a concept map for a completed job',
    description:
      'For jobs published before the concept-map feature existed (or with it disabled): generates a map from the stored segmentation and publishes it immediately, re-deriving video/quiz anchors from the section\'s actual items. The job gains jobStatus.conceptMap. Allowed for the job creator and course staff.',
  })
  @Post('/job/:jobId/generate')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(ConceptMapResponse, {
    description: 'The generated and published concept map',
  })
  @ResponseSchema(GenAINotFoundErrorResponse, {
    description: 'Job not found',
    statusCode: 404,
  })
  async generateRetroactively(
    @Params() params: ConceptMapJobParams,
    @Ability(getGenAIAbility) { ability, user },
  ) {
    const { jobId } = params;
    const job = await this.genAIService.getJobStatus(jobId);

    const isCreator = job.userId?.toString() === user._id.toString();
    const mapRes = subject('ConceptMap', {
      courseId: job.uploadParameters.courseId,
      versionId: job.uploadParameters.versionId,
    });
    if (!isCreator && !ability.can(ConceptMapActions.Preview, mapRes)) {
      throw new ForbiddenError(
        'You do not have permission to generate a concept map for this job',
      );
    }

    const result = await this.genAIService.generateRetroactiveConceptMap(
      jobId,
    );
    if (result.status !== TaskStatus.COMPLETED) {
      // The FAILED attempt is persisted (the teacher can retry); surface why.
      throw new BadRequestError(
        result.error || 'Concept map generation failed',
      );
    }
    return {
      jobId,
      courseId: job.uploadParameters.courseId,
      versionId: job.uploadParameters.versionId,
      moduleId: job.uploadParameters.moduleId,
      sectionId: job.uploadParameters.sectionId,
      nodes: result.nodes,
      edges: result.edges ?? [],
      fallback: result.fallback,
    };
  }
}
