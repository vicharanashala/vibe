const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`Loading Sentry for ${NODE_ENV} environment`);
await import('./instrument.js');

import * as Sentry from '@sentry/node';
import { setupSentryErrorHandling } from './instrument.js';
import express from 'express';
import cors from 'cors';
import {useExpressServer, RoutingControllersOptions} from 'routing-controllers';
import {appConfig} from './config/app.js';
import {loggingHandler} from './shared/middleware/loggingHandler.js';
import {HttpErrorHandler} from './shared/index.js';
import {generateOpenAPISpec} from './shared/functions/generateOpenApiSpec.js';
import {apiReference} from '@scalar/express-api-reference';
import {loadAppModules} from './bootstrap/loadModules.js';
import {printStartupSummary} from './utils/logDetails.js';
import type { CorsOptions } from 'cors';
import { authorizationChecker } from './shared/functions/authorizationChecker.js';
import { currentUserChecker } from './shared/functions/currentUserChecker.js';

const app = express();

app.use(loggingHandler);

const {controllers, validators} = await loadAppModules(appConfig.module.toLowerCase());

const corsOptions: CorsOptions = {
  origin: appConfig.origins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204
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

// Start server
useExpressServer(app, moduleOptions);

app.get("/debug-sentry", function mainHandler(req, res) {
  try {
    const eventId = Sentry.captureMessage("Test message from debug-sentry endpoint");
    console.log(`Sentry test message captured with ID: ${eventId}`);
    
    res.status(200).send({
      message: "Sentry test message captured successfully",
      sentryEventId: eventId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to capture Sentry message",
      error: error.message
    });
  }
});

app.get("/debug-sentry-error", function errorHandler(req, res) {
  throw new Error("Sentry error test!");
});

// Health check endpoint for Cloud Run
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
  console.log('Setting up Sentry error handling - test for production and staging environment');
  setupSentryErrorHandling(app);
}
app.use(function onError(err, req, res, next) {
  let eventId;
  try {
    eventId = Sentry.captureException(err);
    console.log(`Error captured in final handler with Sentry ID: ${eventId}`);
  } catch (sentryError) {
    console.error('Failed to capture error with Sentry:', sentryError);
  }
  
  res.status(500).json({
    error: err.message,
    sentryEventId: eventId || 'unknown',
    timestamp: new Date().toISOString()
  });
});

app.listen(appConfig.port, () => {
  printStartupSummary();
});
