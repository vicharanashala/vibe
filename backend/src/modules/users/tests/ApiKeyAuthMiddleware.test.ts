import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InternalServerError, UnauthorizedError } from 'routing-controllers';
import { appConfig } from '#root/config/app.js';
import { ApiKeyAuthMiddleware } from '#root/shared/middleware/ApiKeyAuthMiddleware.js';

/**
 * Unit tests for the server-to-server API key middleware: named per-consumer
 * keys, the legacy single-key fallback, and fail-closed behaviour.
 * Mutates appConfig.integration directly and restores it after each test.
 */
function makeRequest(apiKey?: string) {
  return {
    method: 'GET',
    originalUrl: '/api/integrations/learners/completions',
    headers: apiKey ? { 'x-api-key': apiKey } : {},
  } as any;
}

function run(request: any) {
  const middleware = new ApiKeyAuthMiddleware();
  const next = vi.fn();
  middleware.use(request, {}, next);
  return next;
}

describe('ApiKeyAuthMiddleware', () => {
  const original = { ...appConfig.integration };

  beforeEach(() => {
    appConfig.integration.apiKey = undefined;
    appConfig.integration.apiKeys = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(appConfig.integration, original);
    vi.restoreAllMocks();
  });

  it('fails closed with a 500 when no key at all is configured', () => {
    expect(() => run(makeRequest('anything'))).toThrow(InternalServerError);
  });

  it('rejects a request with no key header', () => {
    appConfig.integration.apiKeys = 'sakshi:key-a';
    expect(() => run(makeRequest())).toThrow(UnauthorizedError);
  });

  it('rejects an unknown key', () => {
    appConfig.integration.apiKeys = 'sakshi:key-a';
    expect(() => run(makeRequest('key-wrong'))).toThrow(UnauthorizedError);
  });

  it('accepts a named key and attributes the request to that consumer', () => {
    appConfig.integration.apiKeys = 'sakshi:key-a,acme:key-b';
    const request = makeRequest('key-a');

    const next = run(request);

    expect(next).toHaveBeenCalledOnce();
    expect(request.integrationConsumer).toBe('sakshi');
  });

  it('distinguishes between consumers sharing the config', () => {
    appConfig.integration.apiKeys = 'sakshi:key-a,acme:key-b';
    const request = makeRequest('key-b');

    run(request);

    expect(request.integrationConsumer).toBe('acme');
  });

  it('revoking one consumer leaves the others working', () => {
    appConfig.integration.apiKeys = 'acme:key-b'; // sakshi entry removed
    expect(() => run(makeRequest('key-a'))).toThrow(UnauthorizedError);

    const request = makeRequest('key-b');
    run(request);
    expect(request.integrationConsumer).toBe('acme');
  });

  it('still honours the legacy single key so existing consumers do not break', () => {
    appConfig.integration.apiKey = 'legacy-key';
    const request = makeRequest('legacy-key');

    run(request);

    expect(request.integrationConsumer).toBe('legacy');
  });

  it('accepts both named and legacy keys at once during migration', () => {
    appConfig.integration.apiKey = 'legacy-key';
    appConfig.integration.apiKeys = 'sakshi:key-a';

    const named = makeRequest('key-a');
    run(named);
    expect(named.integrationConsumer).toBe('sakshi');

    const legacy = makeRequest('legacy-key');
    run(legacy);
    expect(legacy.integrationConsumer).toBe('legacy');
  });

  it('tolerates whitespace and trailing commas in the config', () => {
    appConfig.integration.apiKeys = ' sakshi : key-a , acme:key-b , ';
    const request = makeRequest('key-a');

    run(request);

    expect(request.integrationConsumer).toBe('sakshi');
  });

  it('keeps keys that contain a colon intact', () => {
    appConfig.integration.apiKeys = 'sakshi:key:with:colons';
    const request = makeRequest('key:with:colons');

    run(request);

    expect(request.integrationConsumer).toBe('sakshi');
  });

  it('ignores malformed entries rather than granting access', () => {
    appConfig.integration.apiKeys = 'noseparator,:emptyname,sakshi:key-a';

    expect(() => run(makeRequest('noseparator'))).toThrow(UnauthorizedError);
    expect(() => run(makeRequest('emptyname'))).toThrow(UnauthorizedError);

    const request = makeRequest('key-a');
    run(request);
    expect(request.integrationConsumer).toBe('sakshi');
  });

  it('never logs the key itself', () => {
    appConfig.integration.apiKeys = 'sakshi:super-secret';
    run(makeRequest('super-secret'));

    const logged = (console.log as any).mock.calls.flat().join(' ');
    expect(logged).toContain('sakshi');
    expect(logged).not.toContain('super-secret');
  });
});
