import { JsonController, Get, Patch, Params, Body, QueryParam, HttpCode, OnUndefined, Authorized, ForbiddenError } from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { getProgressAbility, ProgressActions } from '#root/modules/users/abilities/progressAbilities.js';
import { PacingService } from '../services/PacingService.js';
import { GetUserProgressParams } from '../classes/validators/ProgressValidators.js';
import { SetPacingTargetBody, PacingPlanResponse } from '../classes/validators/PacingValidators.js';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { USERS_TYPES } from '../types.js';
import { subject } from '@casl/ability';

@JsonController('/users')
@injectable()
export class PacingController {
  constructor(@inject(USERS_TYPES.PacingService) private pacingService: PacingService) { }

  @OpenAPI({ summary: 'Get remaining-work pacing plan for a course version' })
  @Authorized()
  @Get('/progress/courses/:courseId/versions/:versionId/pacing')
  @HttpCode(200)
  @ResponseSchema(PacingPlanResponse, { description: 'Pacing plan retrieved successfully' })
  async getPacingPlan(
    @Params() params: GetUserProgressParams,
    @Ability(getProgressAbility) { ability, user },
    @QueryParam('cohortId') cohortId?: string,
    @QueryParam('useTeacherDeadline') useTeacherDeadline?: boolean,
  ): Promise<PacingPlanResponse> {
    const { courseId, versionId } = params;
    const userId = user._id.toString();
    const progressResource = subject('Progress', { userId, courseId, versionId });
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission to view pacing plan');
    }
    const plan = await this.pacingService.getPacingPlan(userId, courseId, versionId, cohortId, useTeacherDeadline);
    return plan as any; // cast for OpenAPI compatibility
  }

  @OpenAPI({ summary: 'Set or clear a target completion date for pacing' })
  @Authorized()
  @Patch('/progress/courses/:courseId/versions/:versionId/pacing-target')
  @HttpCode(200)
  @OnUndefined(200)
  async setPacingTarget(
    @Params() params: GetUserProgressParams,
    @Body() body: SetPacingTargetBody,
    @Ability(getProgressAbility) { ability, user },
  ): Promise<void> {
    const { courseId, versionId } = params;
    const userId = user._id.toString();
    const progressResource = subject('Progress', { userId, courseId, versionId });
    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError('You do not have permission to set pacing target');
    }
    const target = body.targetCompletionDate ? new Date(body.targetCompletionDate) : null;
    await this.pacingService.setPacingTarget(userId, courseId, versionId, target);
  }
}