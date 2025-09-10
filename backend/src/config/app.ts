import {env} from '#root/utils/env.js';

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
  adminPassword: env('ADMIN_PASSWORD') || 'admin123',
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
};
