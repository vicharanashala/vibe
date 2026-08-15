import { describe, it, expect } from 'vitest';
import express from 'express';
import { useExpressServer } from 'routing-controllers';
import { supportChatModuleControllers } from '../index.js';

/**
 * The app mounts routing-controllers with `routePrefix: '/api'`. Controllers
 * that also declare '/api' in their @JsonController path end up served at
 * /api/api/..., which is how the support chat widget silently 404'd against a
 * backend that looked correctly wired. Pin the mounted paths.
 */

function mountedPaths(): string[] {
  const app = express();
  useExpressServer(app, {
    controllers: supportChatModuleControllers as Function[],
    routePrefix: '/api',
    authorizationChecker: async () => true,
  });

  const stack = (app as any)._router?.stack ?? (app as any).router?.stack ?? [];
  return stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => layer.route.path);
}

describe('support chat route mounting', () => {
  it('serves the learner chat under /api/support/chat', () => {
    expect(mountedPaths()).toContain('/api/support/chat/message');
  });

  it('serves the admin dashboard under /api/admin/support', () => {
    expect(mountedPaths()).toContain('/api/admin/support/dashboard');
  });

  it('serves the learner escalation form under /api/support/chat', () => {
    expect(mountedPaths()).toContain('/api/support/chat/:questionId/escalate');
  });

  it('never doubles the api prefix', () => {
    expect(mountedPaths().filter((path) => path.startsWith('/api/api'))).toEqual([]);
  });
});
