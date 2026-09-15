import { ApiKeyAuthMiddleware } from '#root/shared/middleware/ApiKeyAuthMiddleware.js';
import { ProgressService } from '#users/services/ProgressService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  QueryParam,
  UseBefore,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';

/**
 * On-demand triggers for jobs that otherwise run on an in-process
 * node-cron schedule (see backend/src/bootstrap/jobs).
 *
 * node-cron is just a JS timer inside the running process -- on Cloud Run,
 * where the container can scale to zero or have its CPU throttled between
 * requests, the schedule silently misses ticks with no retry (confirmed
 * live: the watch-time recovery cron fired once, then never again). These
 * endpoints let an external scheduler (Cloud Scheduler) trigger the same
 * job logic on demand, so firing no longer depends on a container already
 * being awake at the exact scheduled moment.
 *
 * Additive, not a replacement: the existing cron.schedule() jobs are left
 * running as-is. This is a second, independent way to fire the same
 * logic, not a migration -- environments without Cloud Scheduler configured
 * (this fork's Render deployment, local dev) keep working exactly as
 * before.
 *
 * Authenticates the same way IntegrationController does: a shared secret
 * in the X-API-Key header (see ApiKeyAuthMiddleware), not the Firebase
 * per-user token -- Cloud Scheduler is a calling service, not a logged-in
 * user.
 */
@OpenAPI({
  tags: ['Jobs'],
  security: [{ ApiKeyAuth: [] }],
})
@JsonController('/jobs', { transformResponse: true })
@UseBefore(ApiKeyAuthMiddleware)
@injectable()
class JobsController {
  constructor(
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,
  ) {}

  @OpenAPI({
    summary: 'Trigger the orphaned watch-time recovery sweep on demand',
    description:
      'Runs the same recovery logic as the every-30-minutes cron job ' +
      '(backend/src/bootstrap/jobs/recoverOrphanedWatchTimes.ts), for use by ' +
      'an external scheduler (Cloud Scheduler) instead of relying on the ' +
      "in-process timer firing while a container happens to be awake. " +
      'Authenticate with the `X-API-Key` header.',
  })
  @Post('/recover-orphaned-watchtimes')
  @HttpCode(200)
  async recoverOrphanedWatchTimes(
    @QueryParam('olderThanMinutes') olderThanMinutes = 30,
    @QueryParam('batchSize') batchSize = 500,
  ): Promise<{
    scanned: number;
    closed: number;
    advanced: number;
    rejected: number;
    skipped: number;
  }> {
    // @QueryParam hands back raw strings when the caller actually supplies
    // the param over HTTP (only the `= 30`/`= 500` defaults are real
    // numbers) -- recoverOrphanedWatchTimes passes this straight into
    // Mongo's .limit(), which throws on a non-integer. Coerce explicitly
    // rather than relying on the framework to infer the type from the
    // default value.
    return await this.progressService.recoverOrphanedWatchTimes(
      Number(olderThanMinutes),
      Number(batchSize),
    );
  }
}

export { JobsController };
