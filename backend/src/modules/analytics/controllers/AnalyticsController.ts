import {injectable, inject} from 'inversify';
import {
  Authorized,
  CurrentUser,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Post,
  QueryParams,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {subject} from '@casl/ability';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {
  EnrollmentActions,
  getEnrollmentAbility,
} from '#root/modules/users/abilities/enrollmentAbilities.js';
import type {IUser} from '#root/shared/interfaces/models.js';
import {ANALYTICS_TYPES} from '../types.js';
import {AnalyticsQueryService} from '../services/AnalyticsQueryService.js';
import {AnalyticsProjector} from '../services/AnalyticsProjector.js';
import {
  AnalyticsVersionParams,
  CourseInsightsQuery,
  CourseInsightsResponse,
  RebuildAcceptedResponse,
} from '../classes/validators.js';
import type {CourseInsights} from '../interfaces.js';

const isAdmin = (roles: unknown) =>
  (Array.isArray(roles) ? roles : [roles]).some(
    r => typeof r === 'string' && r.toLowerCase() === 'admin',
  );

@OpenAPI({tags: ['Analytics']})
@JsonController('/analytics')
@injectable()
export class AnalyticsController {
  constructor(
    @inject(ANALYTICS_TYPES.AnalyticsQueryService)
    private readonly query: AnalyticsQueryService,
    @inject(ANALYTICS_TYPES.AnalyticsProjector)
    private readonly projector: AnalyticsProjector,
  ) {}

  @OpenAPI({
    summary: 'Course overview analytics for ViBe Studio',
    description:
      'Every overview panel for a course version over the last 7, 30 or 90 ' +
      'days (IST), from read models kept up to date as events happen. A ' +
      'course viewed for the first time is built gradually: while building, ' +
      'each request advances the build and returns `status: building` with ' +
      '`buildProgress` (0–100) and no figures. Same access as the course ' +
      'enrollment statistics.',
  })
  @Authorized()
  @Get('/courses/:courseId/versions/:versionId/overview')
  @HttpCode(200)
  @ResponseSchema(CourseInsightsResponse, {
    description: 'Course overview analytics',
  })
  async getOverview(
    @Params() params: AnalyticsVersionParams,
    @QueryParams() q: CourseInsightsQuery,
    @Ability(getEnrollmentAbility) {ability},
  ): Promise<CourseInsights> {
    const {courseId, versionId} = params;
    if (
      !ability.can(
        EnrollmentActions.ViewAll,
        subject('Enrollment', {courseId, versionId}),
      )
    ) {
      throw new ForbiddenError(
        'You do not have permission to view analytics for this course',
      );
    }
    return this.query.overview(courseId, versionId, q.range ?? 30);
  }

  @OpenAPI({
    summary: 'Rebuild one course version’s analytics (admin only)',
    description:
      'Drops this version’s analytics and returns straight away. The next ' +
      'overview requests rebuild it gradually, reporting progress.',
  })
  @Authorized()
  @Post('/courses/:courseId/versions/:versionId/rebuild')
  @HttpCode(202)
  @ResponseSchema(RebuildAcceptedResponse, {statusCode: 202})
  async rebuild(
    @Params() params: AnalyticsVersionParams,
    @CurrentUser({required: true}) user: IUser,
  ): Promise<{accepted: boolean}> {
    if (!isAdmin(user?.roles)) {
      throw new ForbiddenError('Only administrators can rebuild analytics');
    }
    await this.projector.resetVersion(params.versionId);
    return {accepted: true};
  }
}
