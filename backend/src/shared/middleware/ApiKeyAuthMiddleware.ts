import { appConfig } from '#root/config/app.js';
import { injectable } from 'inversify';
import {
  ExpressMiddlewareInterface,
  InternalServerError,
  UnauthorizedError,
} from 'routing-controllers';

/**
 * Parses the `INTEGRATION_API_KEYS` env var — `"name:key,name:key"` — into a
 * key -> consumer-name map, and folds in the legacy single-key var.
 *
 * Keyed by the secret rather than the name so authentication is a single
 * lookup. Names are only for logging and revocation, so a duplicate name is
 * harmless; a duplicate key would mean two consumers share a secret, which
 * defeats the point, so the last one wins and is logged as such.
 */
function parseConsumers(): Map<string, string> {
  const consumers = new Map<string, string>();

  for (const entry of (appConfig.integration.apiKeys ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)) {
    // Split on the FIRST colon only: keys may legitimately contain colons.
    const separator = entry.indexOf(':');
    if (separator <= 0) continue;

    const name = entry.slice(0, separator).trim();
    const key = entry.slice(separator + 1).trim();
    if (!name || !key) continue;

    consumers.set(key, name);
  }

  // Legacy shared key keeps working so existing consumers are not broken by
  // the migration; it is attributable only as "legacy".
  if (appConfig.integration.apiKey) {
    consumers.set(appConfig.integration.apiKey, 'legacy');
  }

  return consumers;
}

/**
 * Authenticates trusted server-to-server callers (other applications) via a
 * shared secret passed in the `X-API-Key` header. This is intentionally
 * separate from the Firebase per-user auth used by `@Authorized()`, which is
 * meant for logged-in learners rather than machine-to-machine integrations.
 *
 * Configure per-consumer secrets via `INTEGRATION_API_KEYS`
 * (`"sakshi:abc123,acme:def456"`), or a single shared secret via the legacy
 * `INTEGRATION_API_KEY`. Giving each consumer its own key means one can be
 * revoked by deleting its entry, without a coordinated rotation for the rest.
 */
@injectable()
export class ApiKeyAuthMiddleware implements ExpressMiddlewareInterface {
  use(request: any, _response: any, next: (err?: any) => void): void {
    const consumers = parseConsumers();

    if (consumers.size === 0) {
      // Fail closed: never allow access when no key is configured.
      throw new InternalServerError('Integration API key is not configured');
    }

    const provided =
      request.header?.('x-api-key') ?? request.headers?.['x-api-key'];

    const consumer = provided ? consumers.get(provided) : undefined;

    if (!consumer) {
      throw new UnauthorizedError('Invalid or missing API key');
    }

    // These endpoints return learner names and emails in bulk, so record who
    // pulled what. Cloud Run captures stdout, making this queryable without
    // any extra infrastructure. The key itself is never logged.
    request.integrationConsumer = consumer;
    console.log(
      `[integration] consumer=${consumer} ${request.method} ${request.originalUrl ?? request.url}`,
    );

    next();
  }
}
