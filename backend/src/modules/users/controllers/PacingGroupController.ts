import { JsonController, Get, Put, Delete, Body, HttpCode, OnUndefined, Authorized, ForbiddenError } from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { getProgressAbility, ProgressActions } from '#root/modules/users/abilities/progressAbilities.js';
import { PacingGroupService } from '../services/PacingGroupService.js';
import { SetCombinedPacingTargetBody, CombinedPacingPlanResponse } from '../classes/validators/PacingGroupValidators.js';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { USERS_TYPES } from '../types.js';
import { subject } from '@casl/ability';

@JsonController('/users')
@injectable()
export class PacingGroupController {
  constructor(
    @inject(USERS_TYPES.PacingGroupService) private pacingGroupService: PacingGroupService
  ) { }

  @OpenAPI({ summary: 'Get combined pacing plan for selected courses' })
  @Authorized()
  @Get('/progress/pacing/combined')
  @HttpCode(200)
  @ResponseSchema(CombinedPacingPlanResponse, { description: 'Combined pacing plan retrieved successfully' })
  async getCombinedPacingPlan(
    @Ability(getProgressAbility) { ability, user },
  ): Promise<CombinedPacingPlanResponse> {
    const userId = user._id.toString();
    const plan = await this.pacingGroupService.getCombinedPacingPlan(userId);

    // Enforce ability checks for each course in the plan
    for (const course of plan.courses) {
      const progressResource = subject('Progress', {
        userId,
        courseId: course.courseId,
        versionId: course.courseVersionId,
      });
      if (!ability.can(ProgressActions.View, progressResource)) {
        throw new ForbiddenError('You do not have permission to view pacing plan for these courses');
      }
    }

    return plan as any;
  }

  @OpenAPI({ summary: 'Set or update combined pacing target and course selection' })
  @Authorized()
  @Put('/progress/pacing/combined')
  @HttpCode(200)
  @OnUndefined(200)
  async setCombinedPacingTarget(
    @Body() body: SetCombinedPacingTargetBody,
    @Ability(getProgressAbility) { ability, user },
  ): Promise<void> {
    const userId = user._id.toString();

    // Check permissions
    for (const entry of body.courseSelections) {
      const progressResource = subject('Progress', {
        userId,
        courseId: entry.courseId,
        versionId: entry.courseVersionId,
      });
      if (!ability.can(ProgressActions.Modify, progressResource)) {
        throw new ForbiddenError('You do not have permission to set pacing target for these courses');
      }
    }

    const targetDate = new Date(body.targetCompletionDate);
    await this.pacingGroupService.setCombinedPacingTarget(
      userId,
      targetDate,
      body.courseSelections,
    );
  }

  @OpenAPI({ summary: 'Clear combined pacing plan and course selection' })
  @Authorized()
  @Delete('/progress/pacing/combined')
  @HttpCode(200)
  @OnUndefined(200)
  async clearCombinedPacingTarget(
    @Ability(getProgressAbility) { ability, user },
  ): Promise<void> {
    const userId = user._id.toString();
    await this.pacingGroupService.clearCombinedPacingTarget(userId);
  }
}
