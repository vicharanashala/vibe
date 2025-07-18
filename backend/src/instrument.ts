import * as Sentry from "@sentry/node";
import { appConfig } from "./config/app.js";

const environment = appConfig.sentry.environment;
const dsn = appConfig.sentry.dsn;
const NODE_ENV = process.env.NODE_ENV || 'development';

if ((NODE_ENV === 'production' || NODE_ENV === 'staging' || NODE_ENV === 'development') && dsn) {
  console.log(`Initializing Sentry in ${environment} environment with DSN: ${dsn}`);
  
  Sentry.init({
    dsn: dsn,
    environment: environment,
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
  });
} else {
  console.log(`Sentry initialization skipped. Environment: ${environment}, DSN available: ${Boolean(dsn)}`);
}

export { Sentry };

export function setupSentryErrorHandling(app: any) {
  if (!app) return;
  
  if (typeof Sentry.setupExpressErrorHandler === 'function') {
    console.log('Setting up Sentry Express error handler');
    Sentry.setupExpressErrorHandler(app);
  } else {
    console.log('Using fallback Sentry error handler');
    app.use((err: any, req: any, res: any, next: any) => {
      const eventId = Sentry.captureException(err);
      console.log(`Error captured by Sentry with ID: ${eventId}`);
      next(err);
    });
  }
}

