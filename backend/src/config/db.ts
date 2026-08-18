import {env} from '#root/utils/env.js';

export const dbConfig = {
  // Default to localhost for development when DB_URL is not provided.
  // Production/staging should provide DB_URL explicitly.
  url: env('DB_URL') || 'mongodb://localhost:27017',
  dbName: env('DB_NAME') || 'vibe',
};
