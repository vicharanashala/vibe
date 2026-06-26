import { ApiKeyAuthMiddleware } from '#root/shared/middleware/ApiKeyAuthMiddleware.js';
import { EnrollmentService } from '#users/services/EnrollmentService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
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
}

export { IntegrationController };
