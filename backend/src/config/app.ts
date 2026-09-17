import { env } from '#root/utils/env.js';

// src/constants/AppModule.ts (or a shared constants directory)

export enum AppModule {
  All = 'all',
  Auth = 'auth',
  Users = 'users',
  Courses = 'courses',
  Quizzes = 'quizzes',
}

export const appConfig = {
  isProduction: env('NODE_ENV') === 'production',
  isStaging: env('NODE_ENV') === 'staging',
  isDevelopment: env('NODE_ENV') === 'development',
  port: Number(env('PORT')) || Number(env('APP_PORT')) || 8080,
  url: env('APP_URL'),
  origins: env('APP_ORIGINS')?.split(',') || ['http://localhost:5173'],
  module: env('APP_MODULE') || 'all',
  routePrefix: env('APP_ROUTE_PREFIX') || '/api',
  frontendUrl: env('FRONTEND_URL') || 'http://localhost:5173',
  ENABLE_DB_BACKUP: env('ENABLE_DB_BACKUP') === 'true',
  ENABLE_HP_JOB: env('ENABLE_HP_JOB') === 'true',
  // Default ON: the follow-up invite reconciliation cron self-activates on deploy
  // so it never silently sits idle waiting for an env var to be set. Set
  // ENABLE_FOLLOWUP_INVITE_JOB='false' as a kill switch if it ever needs stopping.
  ENABLE_FOLLOWUP_INVITE_JOB: env('ENABLE_FOLLOWUP_INVITE_JOB') !== 'false',
  // Default ON: the slot-booking fulfillment evaluator (Phase 3) annotates ended
  // windows as FULFILLED/UNFULFILLED. Set ENABLE_FULFILLMENT_JOB='false' to stop.
  ENABLE_FULFILLMENT_JOB: env('ENABLE_FULFILLMENT_JOB') !== 'false',
  // Default OFF, unlike the jobs above: this one closes abandoned watch
  // sessions and moves student progress forward, so it is switched on
  // deliberately per environment after a dry run rather than on deploy.
  ENABLE_WATCHTIME_RECOVERY_JOB:
    env('ENABLE_WATCHTIME_RECOVERY_JOB') === 'true',
  // Default ON: precomputes the average watch hours shown on the teacher
  // statistics panel, which otherwise has to be aggregated per request. It
  // only writes a cached display figure and touches no student progress, so
  // it is safe to self-activate on deploy. Until it first runs, the panel
  // reports watch hours as not yet computed rather than as zero.
  ENABLE_ENROLLMENT_STATS_JOB: env('ENABLE_ENROLLMENT_STATS_JOB') !== 'false',
  GOOGLE_APPLICATION_CREDENTIALS: env('GOOGLE_APPLICATION_CREDENTIALS'),
  GCP_BACKUP_BUCKET: env('GCP_BACKUP_BUCKET'),
  GCP_BACKUP_ACTIVITY_BUCKET: env('GCP_BACKUP_ACTIVITY_BUCKET'),
  // Only for development
  firebase: {
    clientEmail: env('FIREBASE_CLIENT_EMAIL') || undefined,
    privateKey: env('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n') || undefined,
    projectId: env('FIREBASE_PROJECT_ID') || undefined,
    apiKey: env('FIREBASE_API_KEY') || undefined,
    storageBucket: env('FIREBASE_STORAGE_BUCKET') || 'vibe-aiserver-data',
  },
  sentry: {
    dsn: env('SENTRY_DSN') || undefined,
    environment: env('NODE_ENV') || 'development',
    sendDefaultPii: true,
  },
  // Server-to-server integration API (e.g. external apps querying learner completions)
  integration: {
    // Legacy single shared key. Still honoured so existing consumers keep
    // working; prefer giving each consumer its own named key below.
    apiKey: env('INTEGRATION_API_KEY') || undefined,
    // Named per-consumer keys, "name:key,name:key". Lets one consumer be
    // revoked by deleting its entry, without rotating the key for everyone
    // else, and makes each request attributable in the logs.
    apiKeys: env('INTEGRATION_API_KEYS') || undefined,
  },
};
console.log(appConfig.url)
