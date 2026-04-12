import * as Sentry from "@sentry/node";
//import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { appConfig } from "./config/app.js";


const environment = appConfig.sentry.environment;
const dsn = appConfig.sentry.dsn;
const NODE_ENV = process.env.NODE_ENV || 'development';

if ((NODE_ENV === 'production' || NODE_ENV === 'staging' || NODE_ENV === 'development') && dsn) {
  console.log(`Initializing Sentry in ${environment} environment with DSN: ${dsn}`);

  Sentry.init({
    dsn: dsn,
    environment: environment,
    integrations: [
   //   nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    sendDefaultPii: true,
  });
} else {
  console.log(`Sentry initialization skipped. Environment: ${environment}, DSN available: ${Boolean(dsn)}`);
}

export { Sentry };
