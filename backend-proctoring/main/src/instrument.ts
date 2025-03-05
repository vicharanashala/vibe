import Sentry from "@sentry/node";
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { sentryDSN } from "@config/sentry"; 

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: sentryDSN,
  integrations: [
    // Add our Profiling integration
    nodeProfilingIntegration(),
  ],

  // Add Tracing by setting tracesSampleRate
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  // Set sampling rate for profiling
  // This is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});
