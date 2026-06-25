import { appConfig } from '#root/config/app.js';
import { injectable } from 'inversify';
import {
  ExpressMiddlewareInterface,
  InternalServerError,
  UnauthorizedError,
} from 'routing-controllers';

/**
 * Authenticates trusted server-to-server callers (other applications) via a
 * shared secret passed in the `X-API-Key` header. This is intentionally
 * separate from the Firebase per-user auth used by `@Authorized()`, which is
 * meant for logged-in learners rather than machine-to-machine integrations.
 *
 * Configure the secret via the `INTEGRATION_API_KEY` environment variable.
 */
@injectable()
export class ApiKeyAuthMiddleware implements ExpressMiddlewareInterface {
  use(request: any, _response: any, next: (err?: any) => void): void {
    const expected = appConfig.integration.apiKey;

    if (!expected) {
      // Fail closed: never allow access when no key is configured.
      throw new InternalServerError('Integration API key is not configured');
    }

    const provided =
      request.header?.('x-api-key') ?? request.headers?.['x-api-key'];

    if (!provided || provided !== expected) {
      throw new UnauthorizedError('Invalid or missing API key');
    }

    next();
  }
}
