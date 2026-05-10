import 'reflect-metadata';
import Express, { type Express as ExpressApp } from 'express';
import { useExpressServer, type Action } from 'routing-controllers';
import bodyParser from 'body-parser';
import { decodeTestToken } from './testAuth.js';

export interface TestAppOptions {
  controllers: Function[];
  middlewares?: Function[];
  routePrefix?: string;
}

export async function buildTestApp(opts: TestAppOptions): Promise<ExpressApp> {
  const app = Express();
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));

  useExpressServer(app, {
    controllers: opts.controllers,
    middlewares: opts.middlewares ?? [],
    routePrefix: opts.routePrefix,
    validation: true,
    classTransformer: true,
    defaultErrorHandler: true,
    cors: false,
    authorizationChecker: async (action: Action, roles: string[]) => {
      const token = extractBearer(action.request.headers.authorization);
      if (!token) return false;
      try {
        const user = decodeTestToken(token);
        if (!roles || roles.length === 0) return true;
        return roles.some(r => user.roles.includes(r));
      } catch {
        return false;
      }
    },
    currentUserChecker: async (action: Action) => {
      const token = extractBearer(action.request.headers.authorization);
      if (!token) return null;
      try {
        return decodeTestToken(token);
      } catch {
        return null;
      }
    },
  });

  return app;
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
