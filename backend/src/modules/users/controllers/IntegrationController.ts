import { ApiKeyAuthMiddleware } from '#root/shared/middleware/ApiKeyAuthMiddleware.js';
import { EnrollmentService } from '#users/services/EnrollmentService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
  Param,
  QueryParam,
  UseBefore,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';

/**
 * Server-to-server integration endpoints for external applications.
 *
 * These are NOT for logged-in learners. They authenticate the *calling
 * application* via a shared secret in the `X-API-Key` header
 * (see {@link ApiKeyAuthMiddleware}), rather than the Firebase per-user token
 * used by `@Authorized()`.
 */
@OpenAPI({
  tags: ['Integration'],
  security: [{ ApiKeyAuth: [] }],
})
@JsonController('/integrations', { transformResponse: true })
@UseBefore(ApiKeyAuthMiddleware)
@injectable()
class IntegrationController {
  constructor(
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @OpenAPI({
    summary: 'List learners and the courses they have completed',
    description:
      'Returns a paginated roster of every learner on the platform together ' +
      'with the courses each learner has completed (reached the finish line). ' +
      'Authenticate with the `X-API-Key` header. Use `page` and `limit` ' +
      '(max 200) to page through learners.',
  })
  @Get('/learners/completions')
  @HttpCode(200)
  async getLearnersCompletions(
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 50,
  ): Promise<{
    page: number;
    limit: number;
    totalLearners: number;
    totalPages: number;
    learners: Array<{
      userId: string;
      email: string;
      name: string;
      completedCourses: Array<{
        courseId: string;
        courseVersionId: string;
        courseName?: string;
        completedAt?: Date;
      }>;
    }>;
  }> {
    return await this.enrollmentService.getLearnersWithCompletedCourses(
      page,
      limit,
    );
  }

  @OpenAPI({
    summary: 'List candidates who completed a specific course',
    description:
      'Returns a paginated roster of candidates who have completed the ' +
      'given course (identified by `courseId`). Authenticate with the ' +
      '`X-API-Key` header. Use `page` and `limit` (max 200) to page through ' +
      'candidates.',
  })
  @Get('/courses/:courseId/completions')
  @HttpCode(200)
  async getCourseCompletions(
    @Param('courseId') courseId: string,
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 50,
  ): Promise<{
    page: number;
    limit: number;
    totalCandidates: number;
    totalPages: number;
    candidates: Array<{
      userId: string;
      email: string;
      name: string;
      courseVersionId: string;
      completedAt?: Date;
    }>;
  }> {
    return await this.enrollmentService.getCourseCompletions(
      courseId,
      page,
      limit,
    );
  }

  @OpenAPI({
    summary: 'Get the progress roster for a course version',
    description:
      'Returns a paginated roster of every active learner on the given course ' +
      'version together with how far through they are — including learners ' +
      'who have not finished. Authenticate with the `X-API-Key` header. ' +
      'Pass `cohortId` to scope the roster to a single cohort: on a ' +
      'multi-cohort version, omitting it returns every cohort and a learner ' +
      'enrolled in two cohorts appears once per cohort. Use `page` and ' +
      '`limit` (max 200) to page through learners.',
  })
  @Get('/courses/:courseId/versions/:versionId/progress')
  @HttpCode(200)
  async getCourseVersionProgress(
    @Param('courseId') courseId: string,
    @Param('versionId') versionId: string,
    @QueryParam('cohortId') cohortId?: string,
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 50,
  ): Promise<{
    page: number;
    limit: number;
    totalLearners: number;
    totalPages: number;
    cohortId: string | null;
    learners: Array<{
      userId: string;
      email: string;
      name: string;
      courseVersionId: string;
      cohortId: string | null;
      percentCompleted: number;
      completedItems: number;
      totalItems: number;
      completed: boolean;
      completedAt?: Date;
      enrolledAt?: Date;
    }>;
  }> {
    return await this.enrollmentService.getCourseVersionProgress(
      courseId,
      versionId,
      cohortId,
      page,
      limit,
    );
  }
}

export { IntegrationController };
