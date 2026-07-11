import { injectable, inject } from 'inversify';
import {
  JsonController,
  Get,
  Params,
  Authorized,
  HttpCode,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { subject } from '@casl/ability';
import {
  ConceptMapSectionParams,
  ConceptMapJobParams,
  ConceptMapResponse,
  GenAINotFoundErrorResponse,
} from '../classes/validators/GenAIValidators.js';
import { GENAI_TYPES } from '../types.js';
import { GenAIService } from '../services/GenAIService.js';
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
}
