import 'reflect-metadata';
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Loading Sentry for ${NODE_ENV} environment`);

// Ensure Sentry is initialized early. instrument.ts exports the initialized Sentry instance.
const { Sentry } = await import('./instrument.js');

import express from 'express';
// import session from 'express-session'
import { useExpressServer, RoutingControllersOptions } from 'routing-controllers';
import { appConfig } from './config/app.js';
import { loggingHandler } from './shared/middleware/loggingHandler.js';
import { generateOpenAPISpec } from './shared/functions/generateOpenApiSpec.js';
import { getContainer, loadAppModules } from './bootstrap/loadModules.js';
import { createRateLimiter, HttpErrorHandler, MongoDatabase } from './shared/index.js';
import { apiReference } from '@scalar/express-api-reference';
import { printStartupSummary } from './utils/logDetails.js';
import type { CorsOptions } from 'cors';
import { authorizationChecker } from './shared/functions/authorizationChecker.js';
import { currentUserChecker } from './shared/functions/currentUserChecker.js';
import { startCron } from './utils/startCron.js';
import { GLOBAL_TYPES } from './types.js';

const app = express();
const globalRateLimiter = createRateLimiter();

// app.use(globalRateLimiter);
app.use(loggingHandler);

app.set('trust proxy', 1);

// --- Register Sentry request handler early (before controllers/routes)
if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
  console.log('Setting up Sentry request handler for Express');
  try {
    // Some Sentry versions export Handlers under Sentry.Handlers
    if ((Sentry as any)?.Handlers?.requestHandler) {
      app.use((Sentry as any).Handlers.requestHandler());
    } else if ((Sentry as any).requestHandler) {
      // fallback if handlers are exported at top level
      app.use((Sentry as any).requestHandler());
    } else {
      console.warn('Sentry request handler not available; skipping');
    }
  } catch (err) {
    console.warn('Failed to register Sentry request handler:', err);
  }
}

const { controllers, validators } = await loadAppModules(
  appConfig.module.toLowerCase(),
);

const corsOptions: CorsOptions = {
  origin: appConfig.origins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  credentials: true,
  optionsSuccessStatus: 204,
};

const moduleOptions: RoutingControllersOptions = {
  controllers: controllers,
  middlewares: [HttpErrorHandler],
  routePrefix: appConfig.routePrefix,
  authorizationChecker: authorizationChecker,
  currentUserChecker: currentUserChecker,
  defaultErrorHandler: true,
  development: appConfig.isDevelopment,
  validation: true,
  cors: corsOptions,
};

const openApiSpec = await generateOpenAPISpec(moduleOptions, validators);
app.use(
  '/reference',
  apiReference({
    content: openApiSpec,
    theme: 'elysiajs',
  }),
);

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

const database = getContainer().get<MongoDatabase>(GLOBAL_TYPES.Database);
await database.connect();

// Start server (register controllers/routes)
useExpressServer(app, moduleOptions);

// --- Register Sentry error handler after routes and other error handlers
if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
  console.log('Setting up Sentry error handler for Express');
  try {
    if ((Sentry as any)?.Handlers?.errorHandler) {
      app.use((Sentry as any).Handlers.errorHandler());
    } else if ((Sentry as any).errorHandler) {
      app.use((Sentry as any).errorHandler());
    } else {
      console.warn('Sentry error handler not available; skipping');
    }
  } catch (err) {
    console.warn('Failed to register Sentry error handler:', err);
  }
}

app.listen(appConfig.port, () => {
  printStartupSummary();
  startCron();
});
